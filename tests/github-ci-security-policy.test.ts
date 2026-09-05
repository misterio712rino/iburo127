import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = process.cwd();
const pinPolicyScript = resolve(repoRoot, "scripts/check-github-actions-pins.mjs");
const workflowSecurityScript = resolve(repoRoot, "scripts/check-github-workflow-security.mjs");
const ciWorkflowSource = readFileSync(resolve(repoRoot, ".github/workflows/ci.yml"), "utf8");
const checkoutSha = "3d3c42e5aac5ba805825da76410c181273ba90b1";
const setupNodeSha = "820762786026740c76f36085b0efc47a31fe5020";
const setupTerraformSha = "dfe3c3f87815947d99a8997f908cb6525fc44e9e";
const exactCandidateRef = "${{ github.event.pull_request.head.sha || github.sha }}";
const manualOidcCandidateRef = "${{ inputs.candidate_sha }}";

assert.match(
  ciWorkflowSource,
  /timeout-minutes:\s*45/,
  "authoritative CI needs the reviewed 45-minute budget for bounded fail-closed audit retrieval",
);
assert.match(
  ciWorkflowSource,
  new RegExp(`uses: hashicorp/setup-terraform@${setupTerraformSha} # v4\\.0\\.1`),
  "Terraform setup must remain pinned to the reviewed action commit",
);
assert.match(ciWorkflowSource, /terraform_version:\s*1\.16\.1/);
assert.match(
  ciWorkflowSource,
  /- name: Staging scanner Terraform format\s+run: terraform -chdir=infra\/file-scanner-staging fmt -check/,
);
const terraformValidationStep = ciWorkflowSource.match(
  /      - name: Staging scanner Terraform validate\n[\s\S]*?(?=\n      - name:|$)/,
)?.[0];
assert.ok(terraformValidationStep, "authoritative CI must validate the staging scanner Terraform module");
assert.match(terraformValidationStep, /init -backend=false -input=false/);
assert.match(terraformValidationStep, /terraform -chdir=infra\/file-scanner-staging validate/);
assert.doesNotMatch(terraformValidationStep, /terraform (plan|apply)|-backend-config|TF_VAR_|secrets\./);
assert.match(
  ciWorkflowSource,
  /- name: File scanner service tests\s+run: node --test services\/file-scanner\/tests\/\*\.test\.mjs/,
  "Push and PR CI must not silently lose isolated scanner-service security tests",
);

const scannerDockerStep = ciWorkflowSource.match(
  /      - name: File scanner Docker build\n        shell: bash\n        run: \|\n([\s\S]*?)(?=\n      - name:|$)/,
)?.[0];
assert.ok(scannerDockerStep, "Push and PR CI must build the isolated scanner image");
assert.match(
  scannerDockerStep,
  /docker build --pull=false --tag "\$image" services\/file-scanner/,
  "scanner image build context must be exactly services/file-scanner",
);
assert.match(scannerDockerStep, /docker image inspect "\$image"/, "scanner image must receive bounded static inspection");
assert.match(
  scannerDockerStep,
  /docker run --rm --network none --entrypoint \/bin\/sh "\$image"/,
  "scanner container check must be isolated and avoid its service entrypoint",
);
for (const forbidden of [
  /--build-arg/,
  /--secret/,
  /docker login/,
  /docker push/,
  /--push/,
  /--privileged/,
  /--network host/,
  /IB_FILE_SCANNER_SECRET/,
  /BLOB_READ_WRITE_TOKEN/,
  /GITHUB_TOKEN/,
]) {
  assert.doesNotMatch(scannerDockerStep, forbidden, "scanner Docker CI must not receive credentials or privileged deployment capabilities");
}

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
          ref: ${exactCandidateRef}
      - name: Setup Node.js
        uses: actions/setup-node@${setupNodeSha} # v7.0.0
        with:
          node-version-file: .nvmrc
`;
}

function safeManualOidcWorkflow() {
  return `name: Staging publication
on:
  workflow_dispatch:
permissions:
  contents: read
  id-token: write
jobs:
  publish:
    runs-on: ubuntu-24.04
    steps:
      - name: Checkout
        uses: actions/checkout@${checkoutSha} # v7.0.1
        with:
          persist-credentials: false
          ref: ${manualOidcCandidateRef}
      - name: Bind manual OIDC candidate
        run: |
          test "$GITHUB_REF" = "refs/heads/audit/production-readiness"
          test "$CONFIRMATION" = "PUBLISH_STAGING_FILE_SCANNER_IMAGE_ONLY"
          test "$REQUESTED_SHA" = "$GITHUB_SHA"
          git rev-parse HEAD
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

withWorkflow(safeWorkflow().replace(`        with:\n          persist-credentials: false\n          ref: ${exactCandidateRef}\n`, ""), (root) => {
  const result = runPolicy(workflowSecurityScript, root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /GITHUB_WORKFLOW_SECURITY_POLICY_FAIL/);
  assert.match(result.stderr, /persist-credentials: false/);
});

withWorkflow(safeWorkflow().replace(`          ref: ${exactCandidateRef}\n`, ""), (root) => {
  const result = runPolicy(workflowSecurityScript, root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /GITHUB_WORKFLOW_SECURITY_POLICY_FAIL/);
  assert.match(result.stderr, /exact candidate SHA expression/);
});

withWorkflow(safeWorkflow().replace(exactCandidateRef, "${{ github.sha }}"), (root) => {
  const result = runPolicy(workflowSecurityScript, root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /GITHUB_WORKFLOW_SECURITY_POLICY_FAIL/);
  assert.match(result.stderr, /checkout ref must resolve the exact candidate SHA/);
});

withWorkflow(safeManualOidcWorkflow(), (root) => {
  const workflow = runPolicy(workflowSecurityScript, root);
  assert.equal(workflow.status, 0, workflow.stderr || workflow.stdout);
  assert.match(workflow.stdout, /GITHUB_WORKFLOW_SECURITY_POLICY_PASS/);
});

withWorkflow(safeManualOidcWorkflow().replace('id-token: write', 'packages: write'), (root) => {
  const result = runPolicy(workflowSecurityScript, root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /write permission scopes are forbidden/);
});

withWorkflow(safeWorkflow().replace('contents: read', 'contents: read\n  id-token: write'), (root) => {
  const result = runPolicy(workflowSecurityScript, root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /write permission scopes are forbidden/);
});

withWorkflow(safeManualOidcWorkflow().replace('test "$REQUESTED_SHA" = "$GITHUB_SHA"', 'test "$REQUESTED_SHA" = "unbound"'), (root) => {
  const result = runPolicy(workflowSecurityScript, root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /checkout ref must resolve the exact candidate SHA/);
});

assert.equal(
  (ciWorkflowSource.match(/node scripts\/fetch-npm-audit\.mjs/g) ?? []).length,
  2,
  "both CI audit checks must use the bounded retry retrieval boundary",
);
assert.doesNotMatch(ciWorkflowSource, /npm audit --json/);
assert.match(
  ciWorkflowSource,
  /fetch-npm-audit\.mjs "\$RUNNER_TEMP\/npm-audit\.json"[\s\S]*check-npm-audit-policy\.mjs/,
  "dependency audit retrieval must still hand its report to the authoritative policy checker",
);
assert.match(
  ciWorkflowSource,
  /fetch-npm-audit\.mjs "\$RUNNER_TEMP\/npm-audit-prisma-isolation\.json"[\s\S]*check-npm-audit-policy\.mjs/,
  "Prisma isolation audit retrieval must still hand its report to the authoritative policy checker",
);

await import("./npm-audit-retrieval.test.mjs");
await import("./file-scanner-staging-infrastructure-contract.test.mjs");

console.log("GITHUB_CI_SECURITY_POLICY_TEST_PASS");
