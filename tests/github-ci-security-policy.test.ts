import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = process.cwd();
const pinPolicyScript = resolve(repoRoot, "scripts/check-github-actions-pins.mjs");
const workflowSecurityScript = resolve(repoRoot, "scripts/check-github-workflow-security.mjs");
const checkoutSha = "3d3c42e5aac5ba805825da76410c181273ba90b1";
const setupNodeSha = "820762786026740c76f36085b0efc47a31fe5020";

function withWorkflow(source: string, run: (root: string) => void) {
  const root = mkdtempSync(join(tmpdir(), "iburo-ci-policy-"));
  try {
    const workflowDir = join(root, ".github", "workflows");
    mkdirSync(workflowDir, { recursive: true });
    writeFileSync(join(workflowDir, "ci.yml"), source, "utf8");
    run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function runPolicy(script: string, cwd: string) {
  return spawnSync(process.execPath, [script], {
    cwd,
    encoding: "utf8",
    env: { ...process.env },
  });
}

function safeWorkflow() {
  return `name: CI
on:
  pull_request:
permissions:
  contents: read
jobs:
  validate:
    runs-on: ubuntu-24.04
    steps:
      - name: Checkout
        uses: actions/checkout@${checkoutSha} # v7.0.1
        with:
          persist-credentials: false
      - name: Setup Node.js
        uses: actions/setup-node@${setupNodeSha} # v7.0.0
        with:
          node-version-file: .nvmrc
`;
}

withWorkflow(safeWorkflow(), (root) => {
  const pins = runPolicy(pinPolicyScript, root);
  assert.equal(pins.status, 0, pins.stderr || pins.stdout);
  assert.match(pins.stdout, /GITHUB_ACTION_PIN_POLICY_PASS/);

  const workflow = runPolicy(workflowSecurityScript, root);
  assert.equal(workflow.status, 0, workflow.stderr || workflow.stdout);
  assert.match(workflow.stdout, /GITHUB_WORKFLOW_SECURITY_POLICY_PASS/);
});

withWorkflow(safeWorkflow().replace(`actions/setup-node@${setupNodeSha}`, "actions/setup-node@v7"), (root) => {
  const result = runPolicy(pinPolicyScript, root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /GITHUB_ACTION_PIN_POLICY_FAIL/);
  assert.match(result.stderr, /must be pinned to a full lowercase 40-character commit SHA/);
});

withWorkflow(safeWorkflow().replace("contents: read", "contents: write"), (root) => {
  const result = runPolicy(workflowSecurityScript, root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /GITHUB_WORKFLOW_SECURITY_POLICY_FAIL/);
  assert.match(result.stderr, /write permission scopes are forbidden/);
});

withWorkflow(safeWorkflow().replace("  pull_request:", "  pull_request_target:"), (root) => {
  const result = runPolicy(workflowSecurityScript, root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /GITHUB_WORKFLOW_SECURITY_POLICY_FAIL/);
  assert.match(result.stderr, /pull_request_target is forbidden/);
});

withWorkflow(safeWorkflow().replace("runs-on: ubuntu-24.04", "runs-on: ubuntu-latest"), (root) => {
  const result = runPolicy(workflowSecurityScript, root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /GITHUB_WORKFLOW_SECURITY_POLICY_FAIL/);
  assert.match(result.stderr, /runs-on must be pinned to ubuntu-24\.04/);
});

withWorkflow(safeWorkflow().replace("        with:\n          persist-credentials: false\n", ""), (root) => {
  const result = runPolicy(workflowSecurityScript, root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /GITHUB_WORKFLOW_SECURITY_POLICY_FAIL/);
  assert.match(result.stderr, /persist-credentials: false/);
});

console.log("GITHUB_CI_SECURITY_POLICY_TEST_PASS");
