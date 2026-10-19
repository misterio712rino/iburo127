import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const policyPath = path.join(root, "scripts/check-npm-audit-policy.mjs");
const tempDir = await mkdtemp(path.join(os.tmpdir(), "iburo-npm-audit-policy-"));
const auditPath = path.join(tempDir, "audit.json");
const lockPath = path.join(tempDir, "package-lock.json");

const reviewed = [
  ["@next/eslint-plugin-next", "16.4.2", ["fast-glob"]],
  ["braces", "3.0.3", ["https://github.com/advisories/GHSA-vfj7-8cjw-p6xm"]],
  ["eslint-config-next", "16.4.2", ["@next/eslint-plugin-next"]],
  ["fast-glob", "3.3.1", ["micromatch"]],
  ["micromatch", "4.0.8", ["braces"]],
];

function makeReportAndLock({ productionPath = null, unexpectedPackage = null } = {}) {
  const packages = {};
  const vulnerabilities = {};
  for (const [name, version, via] of reviewed) {
    const nodePath = `node_modules/${name}`;
    packages[nodePath] = { version, dev: nodePath === productionPath ? false : true };
    vulnerabilities[name] = {
      severity: "high",
      nodes: [nodePath],
      via: via.map((item) =>
        item.startsWith("https://") ? { name, url: item } : item,
      ),
    };
  }
  if (unexpectedPackage) {
    const nodePath = `node_modules/${unexpectedPackage}`;
    packages[nodePath] = { version: "1.0.0", dev: true };
    vulnerabilities[unexpectedPackage] = { severity: "high", nodes: [nodePath], via: [] };
  }
  return {
    report: {
      vulnerabilities,
      metadata: {
        vulnerabilities: {
          total: Object.keys(vulnerabilities).length,
          high: Object.keys(vulnerabilities).length,
          moderate: 0,
          low: 0,
          critical: 0,
          info: 0,
        },
      },
    },
    lock: { packages },
  };
}

async function runPolicy(options) {
  const { report, lock } = makeReportAndLock(options);
  await writeFile(auditPath, JSON.stringify(report));
  await writeFile(lockPath, JSON.stringify(lock));
  return spawnSync(process.execPath, [policyPath, auditPath, lockPath], { encoding: "utf8" });
}

try {
  const allowed = await runPolicy({});
  assert.equal(allowed.status, 0, allowed.stderr);
  assert.match(allowed.stdout, /dev-only Next\.js ESLint tooling/);

  const production = await runPolicy({ productionPath: "node_modules/braces" });
  assert.notEqual(production.status, 0);
  assert.match(production.stderr, /non-dev-only path/);

  const unexpected = await runPolicy({ unexpectedPackage: "unreviewed-package" });
  assert.notEqual(unexpected.status, 0);
  assert.match(unexpected.stderr, /unexpected vulnerable package/);

  console.log("NPM_AUDIT_POLICY_TEST_PASS");
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
