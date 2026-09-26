import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import test from "node:test";

const checker = resolve("scripts/check-github-workflow-security.mjs");
const checkoutRef = "${{ github.event.pull_request.head.sha || github.sha }}";
const candidate = "${{ inputs.candidate_sha }}";
const confirmation = "${{ inputs.confirmation }}";
const bypass = "${{ secrets.VERCEL_AUTOMATION_BYPASS_SECRET }}";

function safeSmoke() {
  return `name: Staging File Scanner Smoke
on:
  workflow_dispatch:
permissions:
  contents: read
jobs:
  verify:
    permissions:
      contents: read
      id-token: write
    if: github.ref_name == 'audit/production-readiness'
    runs-on: ubuntu-24.04
    env:
      IB_STAGING_BASE_URL: https://iburo127-app-git-audit-producti-0d0d70-misterio712rino-projects.vercel.app
      IB_STAGING_SCANNER_FIXTURE_AUTH_MODE: github-oidc
`;
}
function fixture() {
  return safeSmoke() + `    steps:
      - name: Checkout
        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
          ref: ${checkoutRef}
      - name: Exact staging gate
        env:
          REQUESTED_SHA: ${candidate}
          CONFIRMATION: ${confirmation}
        run: |
          if [ "$CONFIRMATION" != "RUN_STAGING_FILE_SCANNER_SMOKE" ]; then exit 1; fi
          if [ "$GITHUB_REF" != "refs/heads/audit/production-readiness" ]; then exit 1; fi
          actual_sha="$(git rev-parse HEAD)"
          if [ "$actual_sha" != "$GITHUB_SHA" ] || [ "$actual_sha" != "$REQUESTED_SHA" ]; then exit 1; fi
      - name: Verify exact protected Preview identity
        env:
          VERCEL_AUTOMATION_BYPASS_SECRET: ${bypass}
        run: echo preview-identity-check
      - name: Verify live staging scanner CLEAN and MALICIOUS verdicts
        env:
          IB_FILE_SCANNER_ORIGIN: https://scanner-v2-staging.iburo127.online
        run: echo fixture-verification
`;
}
function check(source, filename = "staging-file-scanner-smoke.yml") {
  const root = mkdtempSync(join(tmpdir(), "iburo-scanner-oidc-policy-"));
  try {
    const workflows = join(root, ".github", "workflows");
    mkdirSync(workflows, { recursive: true });
    writeFileSync(join(workflows, filename), source, "utf8");
    return spawnSync(process.execPath, [checker], { cwd: root, encoding: "utf8" });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("permits id-token only for the exact guarded manual scanner smoke workflow", () => {
  const result = check(fixture());
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /GITHUB_WORKFLOW_SECURITY_POLICY_PASS/);
});

test("does not allow another workflow to impersonate the scanner smoke", () => {
  const result = check(fixture(), "ci.yml");
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /GITHUB_WORKFLOW_SECURITY_POLICY_FAIL/);
});
test("rejects weakened guards and permissions", () => {
  const positive = fixture();
  const weakened = [
    positive.replace("RUN_STAGING_FILE_SCANNER_SMOKE", "NO_CONFIRMATION"),
    positive.replace("refs/heads/audit/production-readiness", "refs/heads/main"),
    positive.replace('"$actual_sha" != "$GITHUB_SHA"', '"$actual_sha" != "unbound"'),
    positive.replace("https://scanner-v2-staging.iburo127.online", "https://example.org"),
    positive.replace("IB_STAGING_SCANNER_FIXTURE_AUTH_MODE: github-oidc", "IB_STAGING_SCANNER_FIXTURE_AUTH_MODE: token"),
    positive.replace("  workflow_dispatch:\n", "  workflow_dispatch:\n  push:\n"),
    positive.replace("  workflow_dispatch:\n", "  workflow_dispatch:\n  push: [audit/production-readiness]\n"),
    positive.replace("  workflow_dispatch:\n", "  workflow_dispatch:\n  schedule: [{ cron: '0 8 * * *' }]\n"),
    positive.replace("permissions:\n  contents: read\njobs:", "permissions:\n  contents: read\n  id-token: write\njobs:"),
    positive.replace("      - name: Exact staging gate", "      - name: Missing staging gate"),
    positive.replace("      - name: Verify exact protected Preview identity", "      - name: Other identity"),
    positive.replace("IB_STAGING_SCANNER_FIXTURE_AUTH_MODE: github-oidc", "IB_STAGING_SCANNER_FIXTURE_AUTH_MODE: github-oidc\n      BLOB_READ_WRITE_TOKEN: forbidden"),
    positive + "\n  second-job:\n    runs-on: ubuntu-24.04\n",
  ];
  for (const [index, variant] of weakened.entries()) {
    assert.notEqual(check(variant).status, 0, `weakened variant ${index} must fail`);
  }
});
