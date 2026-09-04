import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const WORKFLOWS_ROOT = ".github/workflows";
const REQUIRED_RUNNER = "ubuntu-24.04";
const REQUIRED_CHECKOUT_REF = "${{ github.event.pull_request.head.sha || github.sha }}";
const MANUAL_OIDC_CHECKOUT_REF = "${{ inputs.candidate_sha }}";

function isBoundedManualOidcWorkflow(source) {
  return (
    /^on:\s*\n\s{2}workflow_dispatch:/m.test(source) &&
    !/^\s{2}(push|pull_request|schedule|workflow_run):/m.test(source) &&
    /id-token:\s*write\s*(?:#.*)?$/m.test(source) &&
    /ref:\s*\$\{\{ inputs\.candidate_sha \}\}/.test(source) &&
    /test "\$GITHUB_REF" = "refs\/heads\/audit\/production-readiness"/.test(source) &&
    /test "\$REQUESTED_SHA" = "\$GITHUB_SHA"/.test(source) &&
    /PUBLISH_STAGING_FILE_SCANNER_IMAGE_ONLY/.test(source) &&
    /git rev-parse HEAD/.test(source)
  );
}

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
let checkoutCount = 0;
let workflowCount = 0;
let runnerCount = 0;

for (const file of collectWorkflowFiles(WORKFLOWS_ROOT)) {
  workflowCount += 1;
  const displayPath = relative(".", file);
  const source = readFileSync(file, "utf8");
  const lines = source.split(/\r?\n/);
  const manualOidcWorkflow = isBoundedManualOidcWorkflow(source);

  if (/^\s*pull_request_target\s*:/m.test(source)) {
    violations.push(`${displayPath}: pull_request_target is forbidden by CI security policy`);
  }
  if (/^\s*workflow_run\s*:/m.test(source)) {
    violations.push(`${displayPath}: workflow_run is forbidden by CI security policy`);
  }
  if (/^\s*permissions\s*:\s*(write-all|read-all)\s*$/m.test(source)) {
    violations.push(`${displayPath}: permissions must be explicit and least-privilege`);
  }
  for (const writeScope of source.matchAll(/^\s*([A-Za-z0-9_-]+)\s*:\s*write\s*(?:#.*)?$/gm)) {
    if (writeScope[1] !== "id-token" || !manualOidcWorkflow) {
      violations.push(`${displayPath}: write permission scopes are forbidden by the current CI policy`);
    }
  }
  if (/^\s*secrets\s*:\s*inherit\s*(?:#.*)?$/m.test(source)) {
    violations.push(`${displayPath}: secrets: inherit is forbidden by CI security policy`);
  }
  if (/^\s*continue-on-error\s*:\s*true\s*(?:#.*)?$/m.test(source)) {
    violations.push(`${displayPath}: continue-on-error: true is forbidden in protected CI workflows`);
  }

  const permissionsBlocks = lines.filter((line) => /^permissions\s*:\s*$/.test(line)).length;
  if (permissionsBlocks !== 1) {
    violations.push(`${displayPath}: exactly one top-level permissions block is required`);
  }
  if (!/^permissions\s*:\s*$\n\s{2}contents\s*:\s*read\s*(?:#.*)?$/m.test(source)) {
    violations.push(`${displayPath}: top-level permissions must declare contents: read`);
  }

  lines.forEach((line, index) => {
    const runnerMatch = line.match(/^\s*runs-on\s*:\s*([^\s#]+)(?:\s*#.*)?$/);
    if (runnerMatch) {
      runnerCount += 1;
      if (runnerMatch[1] !== REQUIRED_RUNNER) {
        violations.push(
          `${displayPath}:${index + 1}: runs-on must be pinned to ${REQUIRED_RUNNER}; got ${runnerMatch[1]}`,
        );
      }
    }

    if (!/^\s*uses:\s*actions\/checkout@/.test(line)) return;
    checkoutCount += 1;

    const lookahead = lines.slice(index + 1, index + 12);
    let persistCredentialsFound = false;
    let checkoutRefFound = false;
    for (const candidate of lookahead) {
      if (/^\s*-\s+name\s*:/.test(candidate)) break;
      if (/^\s*persist-credentials\s*:\s*false\s*(?:#.*)?$/.test(candidate)) {
        persistCredentialsFound = true;
      }
      if (/^\s*persist-credentials\s*:\s*true\s*(?:#.*)?$/.test(candidate)) {
        violations.push(`${displayPath}:${index + 1}: checkout must not persist GitHub credentials`);
        persistCredentialsFound = true;
      }
      const refMatch = candidate.match(/^\s*ref\s*:\s*(.+?)\s*(?:#.*)?$/);
      if (refMatch) {
        checkoutRefFound = true;
        const boundedManualRef = manualOidcWorkflow && refMatch[1] === MANUAL_OIDC_CHECKOUT_REF;
        if (refMatch[1] !== REQUIRED_CHECKOUT_REF && !boundedManualRef) {
          violations.push(
            `${displayPath}:${index + 1}: checkout ref must resolve the exact candidate SHA; expected ${REQUIRED_CHECKOUT_REF}`,
          );
        }
      }
    }
    if (!persistCredentialsFound) {
      violations.push(
        `${displayPath}:${index + 1}: checkout must explicitly set persist-credentials: false`,
      );
    }
    if (!checkoutRefFound) {
      violations.push(
        `${displayPath}:${index + 1}: checkout must explicitly set ref to the exact candidate SHA expression`,
      );
    }
  });
}

if (workflowCount === 0) {
  console.error("GITHUB_WORKFLOW_SECURITY_POLICY_FAIL: no workflow files found");
  process.exit(1);
}
if (checkoutCount === 0) {
  console.error("GITHUB_WORKFLOW_SECURITY_POLICY_FAIL: no checkout step found");
  process.exit(1);
}
if (runnerCount === 0) {
  console.error("GITHUB_WORKFLOW_SECURITY_POLICY_FAIL: no runs-on declaration found");
  process.exit(1);
}
if (violations.length > 0) {
  console.error("GITHUB_WORKFLOW_SECURITY_POLICY_FAIL");
  for (const violation of violations) console.error(violation);
  process.exit(1);
}

console.log(
  `GITHUB_WORKFLOW_SECURITY_POLICY_PASS: ${workflowCount} workflow(s), ${checkoutCount} checkout step(s), ${runnerCount} runner(s) hardened`,
);
