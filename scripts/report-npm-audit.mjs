import { readFile } from "node:fs/promises";

const inputPath = process.argv[2];
if (!inputPath) {
  console.log("DEPENDENCY_AUDIT_UNAVAILABLE: missing report path");
  process.exit(0);
}

let report;
try {
  report = JSON.parse(await readFile(inputPath, "utf8"));
} catch {
  console.log("DEPENDENCY_AUDIT_UNAVAILABLE: invalid npm audit report");
  process.exit(0);
}

const counts = report?.metadata?.vulnerabilities ?? {};
const vulnerabilities = report?.vulnerabilities;
if (!vulnerabilities || typeof vulnerabilities !== "object" || Array.isArray(vulnerabilities)) {
  const errorCode = typeof report?.error?.code === "string"
    ? report.error.code.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 80)
    : "UNKNOWN";
  console.log(`DEPENDENCY_AUDIT_UNAVAILABLE: ${errorCode}`);
  process.exit(0);
}

const severityRank = { critical: 5, high: 4, moderate: 3, low: 2, info: 1 };
const entries = Object.entries(vulnerabilities)
  .map(([name, value]) => ({ name, ...value }))
  .sort((a, b) => {
    const severityDelta = (severityRank[b.severity] ?? 0) - (severityRank[a.severity] ?? 0);
    return severityDelta || a.name.localeCompare(b.name);
  });

const total = Number(counts.total ?? entries.length);
console.log(
  `DEPENDENCY_AUDIT_SUMMARY: total=${total} critical=${Number(counts.critical ?? 0)} high=${Number(counts.high ?? 0)} moderate=${Number(counts.moderate ?? 0)} low=${Number(counts.low ?? 0)}`,
);

for (const item of entries) {
  const safeName = String(item.name).replace(/[^A-Za-z0-9@/_.-]/g, "_").slice(0, 160);
  const safeSeverity = String(item.severity ?? "unknown").replace(/[^A-Za-z]/g, "").slice(0, 20) || "unknown";
  const direct = item.isDirect === true ? "yes" : "no";
  let fix = "none";
  if (item.fixAvailable === true) {
    fix = "available";
  } else if (item.fixAvailable && typeof item.fixAvailable === "object") {
    const fixName = String(item.fixAvailable.name ?? "").replace(/[^A-Za-z0-9@/_.-]/g, "_").slice(0, 160);
    const fixVersion = String(item.fixAvailable.version ?? "").replace(/[^A-Za-z0-9+_.-]/g, "_").slice(0, 80);
    const major = item.fixAvailable.isSemVerMajor === true ? "major" : "compatible";
    fix = `${fixName}@${fixVersion}:${major}`;
  }
  console.log(`DEPENDENCY_AUDIT_ITEM: package=${safeName} severity=${safeSeverity} direct=${direct} fix=${fix}`);
}
