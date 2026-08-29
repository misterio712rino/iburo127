import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
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

const root = mkdtempSync(join(tmpdir(), "iburo-secret-history-"));
try {
  git(root, ["init", "-q"]);
  git(root, ["config", "user.name", "Security Test"]);
  git(root, ["config", "user.email", "security-test@example.invalid"]);
  mkdirSync(join(root, "security"), { recursive: true });
  writeFileSync(join(root, "security", "secret-history-allowlist.json"), "{}\n", "utf8");
  writeFileSync(join(root, "safe.txt"), "safe\n", "utf8");
  commitAll(root, "safe root");

  const secret = "sk-" + "H".repeat(32);
  writeFileSync(join(root, "leak.txt"), `OPENAI_API_KEY=${secret}\n`, "utf8");
  commitAll(root, "introduce historical fixture");
  const blobSha = git(root, ["rev-parse", "HEAD:leak.txt"]);

  unlinkSync(join(root, "leak.txt"));
  commitAll(root, "remove historical fixture");

  const blocked = spawnSync(process.execPath, [scanner, root], { encoding: "utf8" });
  assert.notEqual(blocked.status, 0);
  assert.match(blocked.stderr, /SECRET_HISTORY_EXPOSURE_POLICY_FAIL/);
  assert.match(blocked.stderr, new RegExp(blobSha));
  assert.match(blocked.stderr, /openai-key detector matched/);
  assert.doesNotMatch(blocked.stderr, /H{20,}/);

  writeFileSync(
    join(root, "security", "secret-history-allowlist.json"),
    `${JSON.stringify({ [blobSha]: ["openai-key"] }, null, 2)}\n`,
    "utf8",
  );
  commitAll(root, "review exact historical blob");

  const allowed = spawnSync(process.execPath, [scanner, root], { encoding: "utf8" });
  assert.equal(allowed.status, 0, allowed.stderr || allowed.stdout);
  assert.match(allowed.stdout, /SECRET_HISTORY_EXPOSURE_POLICY_PASS/);

  writeFileSync(join(root, ".env"), "TOKEN=example\n", "utf8");
  commitAll(root, "track forbidden env");
  unlinkSync(join(root, ".env"));
  commitAll(root, "remove forbidden env");
  const envBlocked = spawnSync(process.execPath, [scanner, root], { encoding: "utf8" });
  assert.notEqual(envBlocked.status, 0);
  assert.match(envBlocked.stderr, /tracked environment file existed in candidate history/);
} finally {
  rmSync(root, { recursive: true, force: true });
}

console.log("SECRET_HISTORY_EXPOSURE_POLICY_TEST_PASS");
