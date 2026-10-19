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

// The remaining full-audit findings are the Next.js ESLint config's dev-only
// globbing chain. GitHub Advisory Database currently lists no patched braces
// release. Pin the exact reviewed graph and require every affected lockfile node
// to remain dev-only; any new package, version, severity, or production path fails.
const reviewedDevOnlyResiduals = new Map([
  ["@next/eslint-plugin-next", { version: "16.4.2", via: ["fast-glob"] }],
  ["braces", { version: "3.0.3", via: ["GHSA-vfj7-8cjw-p6xm"] }],
  ["eslint-config-next", { version: "16.4.2", via: ["@next/eslint-plugin-next"] }],
  ["fast-glob", { version: "3.3.1", via: ["micromatch"] }],
  ["micromatch", { version: "4.0.8", via: ["braces"] }],
]);

const entries = Object.entries(vulnerabilities);
const counts = report?.metadata?.vulnerabilities ?? {};
if (
  Number(counts.critical ?? 0) !== 0 ||
  Number(counts.high ?? 0) !== entries.length ||
  Number(counts.moderate ?? 0) !== 0 ||
  Number(counts.low ?? 0) !== 0 ||
  Number(counts.info ?? 0) !== 0 ||
  Number(counts.total ?? entries.length) !== entries.length
) {
  console.error("DEPENDENCY_AUDIT_POLICY_FAIL: unexpected vulnerability counts");
  process.exit(1);
}

for (const [name, vulnerability] of entries) {
  const expected = reviewedDevOnlyResiduals.get(name);
  if (!expected) {
    console.error(`DEPENDENCY_AUDIT_POLICY_FAIL: unexpected vulnerable package ${name}`);
    process.exit(1);
  }
  if (vulnerability?.severity !== "high") {
    console.error(`DEPENDENCY_AUDIT_POLICY_FAIL: unexpected severity for ${name}`);
    process.exit(1);
  }

  const observedVia = (vulnerability.via ?? []).map((item) =>
    typeof item === "string" ? item : item?.url?.split("/").at(-1),
  );
  if (
    observedVia.length !== expected.via.length ||
    observedVia.some((item, index) => item !== expected.via[index])
  ) {
    console.error(`DEPENDENCY_AUDIT_POLICY_FAIL: unreviewed advisory path for ${name}`);
    process.exit(1);
  }

  const nodes = vulnerability.nodes;
  if (!Array.isArray(nodes) || nodes.length === 0) {
    console.error(`DEPENDENCY_AUDIT_POLICY_FAIL: missing lockfile paths for ${name}`);
    process.exit(1);
  }
  for (const nodePath of nodes) {
    const packageEntry = lockfile?.packages?.[nodePath];
    if (
      !packageEntry ||
      packageEntry.version !== expected.version ||
      packageEntry.dev !== true ||
      packageEntry.devOptional === true
    ) {
      console.error(`DEPENDENCY_AUDIT_POLICY_FAIL: unreviewed or non-dev-only path for ${name}`);
      process.exit(1);
    }
  }
}

console.log(
  entries.length === 0
    ? "DEPENDENCY_AUDIT_POLICY_PASS: no vulnerabilities reported"
    : `DEPENDENCY_AUDIT_POLICY_PASS: ${entries.length} reviewed high findings are confined to dev-only Next.js ESLint tooling; no production findings`,
);
