import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const scanner = resolve(process.cwd(), "scripts/check-secret-history-exposure.mjs");

function git(root, args) {
  return execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();
}

function commitAll(root, message) {
  git(root, ["add", "."]);
  git(root, ["commit", "-q", "-m", message]);
}

function runScanner(root, ...refs) {
  return spawnSync(process.execPath, [scanner, root, ...refs], { encoding: "utf8" });
}

function writeAllowlist(root, value) {
  writeFileSync(
    join(root, "security", "secret-history-allowlist.json"),
    `${JSON.stringify(value, null, 2)}\n`,
    "utf8",
  );
}

function withRepo(run) {
  const root = mkdtempSync(join(tmpdir(), "iburo-secret-history-"));
  try {
    git(root, ["init", "-q"]);
    git(root, ["config", "user.name", "Security Test"]);
    git(root, ["config", "user.email", "security-test@example.invalid"]);
    mkdirSync(join(root, "security"), { recursive: true });
    writeAllowlist(root, {});
    writeFileSync(join(root, "safe.txt"), "safe\n", "utf8");
    commitAll(root, "safe root");
    run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

withRepo((root) => {
  const clean = runScanner(root);
  assert.equal(clean.status, 0, clean.stderr || clean.stdout);
  assert.match(clean.stdout, /SECRET_HISTORY_EXPOSURE_POLICY_PASS/);
});

withRepo((root) => {
  const secret = "sk-" + "H".repeat(32);
  const leakPath = "leak.txt";
  writeFileSync(join(root, leakPath), `OPENAI_API_KEY=${secret}\n`, "utf8");
  commitAll(root, "introduce historical fixture");
  const leakCommit = git(root, ["rev-parse", "HEAD"]);
  const blobSha = git(root, ["rev-parse", `HEAD:${leakPath}`]);

  unlinkSync(join(root, leakPath));
  commitAll(root, "remove historical fixture");
  assert.equal(existsSync(join(root, leakPath)), false);
  assert.equal(git(root, ["ls-files", leakPath]), "");

  const blocked = runScanner(root);
  assert.notEqual(blocked.status, 0);
  assert.match(blocked.stderr, /SECRET_HISTORY_EXPOSURE_POLICY_FAIL/);
  assert.match(blocked.stderr, new RegExp(leakCommit));
  assert.match(blocked.stderr, new RegExp(blobSha));
  assert.match(blocked.stderr, new RegExp(leakPath.replace(".", "\\.")));
  assert.match(blocked.stderr, /openai-key detector matched/);
  assert.equal(blocked.stdout.includes(secret), false);
  assert.equal(blocked.stderr.includes(secret), false);

  writeAllowlist(root, { [leakPath]: { [blobSha]: ["openai-key"] } });
  commitAll(root, "review exact historical blob path");

  const allowed = runScanner(root);
  assert.equal(allowed.status, 0, allowed.stderr || allowed.stdout);
  assert.match(allowed.stdout, /SECRET_HISTORY_EXPOSURE_POLICY_PASS/);

  const copiedPath = "copied-fixture.txt";
  writeFileSync(join(root, copiedPath), `OPENAI_API_KEY=${secret}\n`, "utf8");
  commitAll(root, "copy fixture to unreviewed path");
  assert.equal(git(root, ["rev-parse", `HEAD:${copiedPath}`]), blobSha);

  const copiedBlocked = runScanner(root);
  assert.notEqual(copiedBlocked.status, 0);
  assert.match(copiedBlocked.stderr, /openai-key detector matched/);
  assert.match(copiedBlocked.stderr, /copied-fixture\.txt/);
  assert.equal(copiedBlocked.stdout.includes(secret), false);
  assert.equal(copiedBlocked.stderr.includes(secret), false);
});

withRepo((root) => {
  writeFileSync(join(root, ".env"), "TOKEN=example\n", "utf8");
  commitAll(root, "track forbidden env");
  const envCommit = git(root, ["rev-parse", "HEAD"]);
  unlinkSync(join(root, ".env"));
  commitAll(root, "remove forbidden env");

  const envBlocked = runScanner(root);
  assert.notEqual(envBlocked.status, 0);
  assert.match(envBlocked.stderr, /tracked environment file existed in candidate history/);
  assert.match(envBlocked.stderr, new RegExp(envCommit));
  assert.match(envBlocked.stderr, /"\.env"/);
});

console.log("SECRET_HISTORY_EXPOSURE_POLICY_TEST_PASS");
