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

// Reviewed upstream residuals are accepted only at this exact Prisma CLI layout.
// mysql2 GHSA-3f6p-5ww8-9rcr is not a runtime dependency of this PostgreSQL app:
// Prisma CLI 7.9.1 pins mysql2 3.15.3 for development tooling. npm currently offers
// only a forced breaking Prisma downgrade as an audit fix, so the policy fails closed
// if the alias, versions, dev-only placement, or vulnerable-package set changes.
const allowedResidual = new Map([
  ["prisma", { version: "7.9.1", severity: "high" }],
  ["@prisma/config", { version: "7.9.1", severity: "high" }],
  ["deepmerge-ts", { version: "7.1.5", severity: "high" }],
  ["mysql2", { version: "3.15.3", severity: "high" }],
]);

const root = lockfile?.packages?.[""];
const prismaCli = lockfile?.packages?.["node_modules/prisma-cli"];
const mysql2 = lockfile?.packages?.["node_modules/mysql2"];
if (!root || !prismaCli || !mysql2) {
  console.error("DEPENDENCY_AUDIT_POLICY_FAIL: expected Prisma CLI residual layout is missing");
  process.exit(1);
}
if (root?.devDependencies?.["prisma-cli"] !== "npm:prisma@7.9.1") {
  console.error("DEPENDENCY_AUDIT_POLICY_FAIL: Prisma CLI alias changed");
  process.exit(1);
}
for (const runtimeGroup of ["dependencies", "optionalDependencies"]) {
  if (root?.[runtimeGroup]?.["prisma-cli"] || root?.[runtimeGroup]?.mysql2) {
    console.error("DEPENDENCY_AUDIT_POLICY_FAIL: Prisma CLI/mysql2 entered a root runtime dependency group");
    process.exit(1);
  }
}
if (prismaCli.name !== "prisma" || prismaCli.version !== "7.9.1" || prismaCli.dev !== true) {
  console.error("DEPENDENCY_AUDIT_POLICY_FAIL: Prisma CLI is no longer the reviewed dev-only 7.9.1 package");
  process.exit(1);
}
if (prismaCli.dependencies?.mysql2 !== "3.15.3") {
  console.error("DEPENDENCY_AUDIT_POLICY_FAIL: Prisma CLI mysql2 pin changed");
  process.exit(1);
}
if (mysql2.version !== "3.15.3" || (mysql2.dev !== true && mysql2.devOptional !== true)) {
  console.error("DEPENDENCY_AUDIT_POLICY_FAIL: mysql2 is no longer the reviewed dev-only 3.15.3 package");
  process.exit(1);
}

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

  const candidatePaths =
    name === "prisma"
      ? ["node_modules/prisma", "node_modules/prisma-cli"]
      : [`node_modules/${name}`];
  const installedVersions = candidatePaths
    .map((packagePath) => lockfile?.packages?.[packagePath]?.version)
    .filter(Boolean);

  if (installedVersions.length !== 1 || installedVersions[0] !== allowed.version) {
    console.error(`DEPENDENCY_AUDIT_POLICY_FAIL: unreviewed vulnerable version or layout for ${name}`);
    process.exit(1);
  }
}

const expectedNames = [...allowedResidual.keys()].sort();
const actualNames = entries.map(([name]) => name).sort();
if (actualNames.length !== expectedNames.length || actualNames.some((name, index) => name !== expectedNames[index])) {
  console.error("DEPENDENCY_AUDIT_POLICY_FAIL: reviewed residual set changed");
  process.exit(1);
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
  "DEPENDENCY_AUDIT_POLICY_PASS: 4 reviewed Prisma CLI upstream residual findings; mysql2 remains dev-only and production isolation is required; no unreviewed findings",
);
