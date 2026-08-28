import { readFile } from "node:fs/promises";

const [auditPath, lockPath] = process.argv.slice(2);
if (!auditPath || !lockPath) {
  console.error("DEPENDENCY_AUDIT_POLICY_FAIL: missing audit or lockfile path");
  process.exit(1);
}

let report;
let lockfile;
try {
  report = JSON.parse(await readFile(auditPath, "utf8"));
  lockfile = JSON.parse(await readFile(lockPath, "utf8"));
} catch {
  console.error("DEPENDENCY_AUDIT_POLICY_FAIL: unreadable audit report or lockfile");
  process.exit(1);
}

if (report?.error) {
  console.error("DEPENDENCY_AUDIT_POLICY_FAIL: npm audit unavailable");
  process.exit(1);
}

const vulnerabilities = report?.vulnerabilities;
if (!vulnerabilities || typeof vulnerabilities !== "object" || Array.isArray(vulnerabilities)) {
  console.error("DEPENDENCY_AUDIT_POLICY_FAIL: invalid npm audit payload");
  process.exit(1);
}

const allowedResidual = new Map([
  ["prisma", { version: "7.9.1", severity: "high" }],
  ["@prisma/config", { version: "7.9.1", severity: "high" }],
  ["deepmerge-ts", { version: "7.1.5", severity: "high" }],
]);

const entries = Object.entries(vulnerabilities);
if (entries.length === 0) {
  console.log("DEPENDENCY_AUDIT_POLICY_PASS: no vulnerabilities reported");
  process.exit(0);
}

for (const [name, vulnerability] of entries) {
  const allowed = allowedResidual.get(name);
  if (!allowed) {
    console.error(`DEPENDENCY_AUDIT_POLICY_FAIL: unexpected vulnerable package ${name}`);
    process.exit(1);
  }

  if (vulnerability?.severity !== allowed.severity) {
    console.error(`DEPENDENCY_AUDIT_POLICY_FAIL: unexpected severity for ${name}`);
    process.exit(1);
  }

  const packagePath = `node_modules/${name}`;
  const installedVersion = lockfile?.packages?.[packagePath]?.version;
  if (installedVersion !== allowed.version) {
    console.error(`DEPENDENCY_AUDIT_POLICY_FAIL: unreviewed vulnerable version for ${name}`);
    process.exit(1);
  }
}

const counts = report?.metadata?.vulnerabilities ?? {};
const expectedHigh = entries.length;
if (
  Number(counts.critical ?? 0) !== 0 ||
  Number(counts.high ?? 0) !== expectedHigh ||
  Number(counts.moderate ?? 0) !== 0 ||
  Number(counts.low ?? 0) !== 0 ||
  Number(counts.info ?? 0) !== 0 ||
  Number(counts.total ?? entries.length) !== entries.length
) {
  console.error("DEPENDENCY_AUDIT_POLICY_FAIL: unexpected vulnerability counts");
  process.exit(1);
}

console.log(
  `DEPENDENCY_AUDIT_POLICY_PASS: ${entries.length} reviewed Prisma upstream residual finding(s); no unreviewed findings`,
);
