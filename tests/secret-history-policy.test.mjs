import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const scanner = resolve(process.cwd(), "scripts/check-secret-history.mjs");

function git(cwd, ...args) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

function runScanner(cwd) {
  return spawnSync(process.execPath, [scanner, "HEAD"], {
    cwd,
    encoding: "utf8",
    env: { ...process.env },
  });
}

function withRepo(run) {
  const root = mkdtempSync(join(tmpdir(), "iburo-secret-history-"));
  try {
    mkdirSync(join(root, "security"), { recursive: true });
    writeFileSync(join(root, "security", "secret-exposure-allowlist.json"), "{}\n", "utf8");
    git(root, "init", "-q");
    git(root, "config", "user.email", "fixture@example.invalid");
    git(root, "config", "user.name", "Fixture");
    run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

withRepo((root) => {
  writeFileSync(join(root, "safe.txt"), "safe content\n", "utf8");
  git(root, "add", ".");
  git(root, "commit", "-qm", "safe");
  const result = runScanner(root);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /SECRET_HISTORY_POLICY_PASS/);
});

withRepo((root) => {
  const leaked = "sk-fixtureHistorySecretValue123456789";
  writeFileSync(join(root, "leak.txt"), `${leaked}\n`, "utf8");
  git(root, "add", ".");
  git(root, "commit", "-qm", "leak");
  writeFileSync(join(root, "leak.txt"), "removed from current snapshot\n", "utf8");
  git(root, "add", ".");
  git(root, "commit", "-qm", "remove leak");

  const result = runScanner(root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /SECRET_HISTORY_POLICY_FAIL/);
  assert.match(result.stderr, /openai-key detector matched/);
  assert.doesNotMatch(result.stdout, new RegExp(leaked));
  assert.doesNotMatch(result.stderr, new RegExp(leaked));
});

withRepo((root) => {
  writeFileSync(join(root, ".env.production"), "SAFE_PLACEHOLDER=1\n", "utf8");
  git(root, "add", ".");
  git(root, "commit", "-qm", "tracked env");
  const result = runScanner(root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /tracked environment file is forbidden/);
});

console.log("SECRET_HISTORY_POLICY_TEST_PASS");
