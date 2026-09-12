import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const WORKFLOWS_ROOT = ".github/workflows";
const SHA_PATTERN = /^[0-9a-f]{40}$/;
const APPROVED_ACTION_REFS = new Map([
  ["actions/checkout", new Set(["3d3c42e5aac5ba805825da76410c181273ba90b1"])], // v7.0.1
  ["actions/setup-node", new Set(["820762786026740c76f36085b0efc47a31fe5020"])], // v7.0.0
  ["actions/upload-artifact", new Set(["043fb46d1a93c77aae656e7c1c64a875d1fc6a0a"])], // v7.0.1
  ["hashicorp/setup-terraform", new Set(["dfe3c3f87815947d99a8997f908cb6525fc44e9e"])], // v4.0.1
]);

function collectWorkflowFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory)) {
    const absolute = join(directory, entry);
    const stat = statSync(absolute);
    if (stat.isDirectory()) {
      files.push(...collectWorkflowFiles(absolute));
      continue;
    }
    if (/\.ya?ml$/i.test(entry)) files.push(absolute);
  }
  return files;
}

const violations = [];
let externalActionCount = 0;

for (const file of collectWorkflowFiles(WORKFLOWS_ROOT)) {
  const source = readFileSync(file, "utf8");
  const lines = source.split(/\r?\n/);

  lines.forEach((line, index) => {
    const match = line.match(/^\s*-?\s*uses:\s*([^\s#]+)(?:\s*#.*)?$/);
    if (!match) return;

    const reference = match[1];
    if (reference.startsWith("./")) return;

    if (reference.startsWith("docker://")) {
      violations.push(`${relative(".", file)}:${index + 1}: docker actions are not allowed by this policy`);
      return;
    }

    const atIndex = reference.lastIndexOf("@");
    if (atIndex <= 0 || atIndex === reference.length - 1) {
      violations.push(`${relative(".", file)}:${index + 1}: malformed external action reference`);
      return;
    }

    externalActionCount += 1;
    const action = reference.slice(0, atIndex);
    const ref = reference.slice(atIndex + 1);

    if (!/^[^/\s]+\/[^@\s]+$/.test(action)) {
      violations.push(`${relative(".", file)}:${index + 1}: malformed action repository ${action}`);
      return;
    }

    if (!SHA_PATTERN.test(ref)) {
      violations.push(
        `${relative(".", file)}:${index + 1}: ${action} must be pinned to a full lowercase 40-character commit SHA`,
      );
      return;
    }

    const approvedRefs = APPROVED_ACTION_REFS.get(action);
    if (!approvedRefs) {
      violations.push(`${relative(".", file)}:${index + 1}: action repository ${action} is not approved by this policy`);
      return;
    }

    if (!approvedRefs.has(ref)) {
      violations.push(
        `${relative(".", file)}:${index + 1}: ${action}@${ref} is not an approved immutable action revision`,
      );
    }
  });
}

if (externalActionCount === 0) {
  console.error("GITHUB_ACTION_PIN_POLICY_FAIL: no external GitHub Actions references found");
  process.exit(1);
}

if (violations.length > 0) {
  console.error("GITHUB_ACTION_PIN_POLICY_FAIL");
  for (const violation of violations) console.error(violation);
  process.exit(1);
}

console.log(
  `GITHUB_ACTION_PIN_POLICY_PASS: ${externalActionCount} external action reference(s) pinned to ${APPROVED_ACTION_REFS.size} approved repository/revision allowlist entries`,
);
