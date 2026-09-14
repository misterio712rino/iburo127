import { readFile } from "node:fs/promises";

const inputPath = process.argv[2];
if (!inputPath) {
  console.log("DEPENDENCY_AUDIT_UNAVAILABLE: missing report path");
  process.exit(0);
}

function safePackageName(value) {
  return String(value ?? "")
    .replace(/[^A-Za-z0-9@/_.-]/g, "_")
    .slice(0, 160) || "unknown";
}

function safeVersion(value) {
  return String(value ?? "")
    .replace(/[^A-Za-z0-9+_.-]/g, "_")
    .slice(0, 80) || "unknown";
}

function safeList(values) {
  const unique = [...new Set(values.filter(Boolean).map(safePackageName))];
  return unique.length ? unique.join(",") : "none";
}

let report;
try {
  report = JSON.parse(await readFile(inputPath, "utf8"));
} catch {
  console.log("DEPENDENCY_AUDIT_UNAVAILABLE: invalid npm audit report");
  process.exit(0);
}

let packageLock = null;
try {
  packageLock = JSON.parse(await readFile("package-lock.json", "utf8"));
} catch {
  // Version details are supplemental. Keep the audit report usable without the lockfile.
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
  const safeName = safePackageName(item.name);
  const safeSeverity = String(item.severity ?? "unknown").replace(/[^A-Za-z]/g, "").slice(0, 20) || "unknown";
  const direct = item.isDirect === true ? "yes" : "no";

  const nodes = Array.isArray(item.nodes) ? item.nodes.filter((value) => typeof value === "string") : [];
  const installedVersions = [...new Set(
    nodes
      .map((node) => packageLock?.packages?.[node]?.version)
      .filter((version) => typeof version === "string")
      .map(safeVersion),
  )];
  const installed = installedVersions.length ? installedVersions.join(",") : "unknown";

  const via = Array.isArray(item.via)
    ? item.via.map((entry) => {
        if (typeof entry === "string") return entry;
        if (entry && typeof entry === "object" && typeof entry.name === "string") return entry.name;
        return null;
      })
    : [];
  const effects = Array.isArray(item.effects)
    ? item.effects.filter((entry) => typeof entry === "string")
    : [];

  let fix = "none";
  if (item.fixAvailable === true) {
    fix = "available";
  } else if (item.fixAvailable && typeof item.fixAvailable === "object") {
    const fixName = safePackageName(item.fixAvailable.name);
    const fixVersion = safeVersion(item.fixAvailable.version);
    const major = item.fixAvailable.isSemVerMajor === true ? "major" : "compatible";
    fix = `${fixName}@${fixVersion}:${major}`;
  }

  console.log(
    `DEPENDENCY_AUDIT_ITEM: package=${safeName} installed=${installed} severity=${safeSeverity} direct=${direct} via=${safeList(via)} effects=${safeList(effects)} fix=${fix}`,
  );
}
