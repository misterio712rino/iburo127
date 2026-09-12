import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const scanner = resolve(process.cwd(), "scripts/check-secret-exposure.mjs");

function withRepo(files, run) {
  const root = mkdtempSync(join(tmpdir(), "iburo-secret-policy-"));
  try {
    execFileSync("git", ["init", "-q", root]);
    for (const [path, content] of Object.entries(files)) {
      writeFileSync(join(root, path), content, "utf8");
    }
    execFileSync("git", ["-C", root, "add", "."]);
    run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function scan(root) {
  return spawnSync(process.execPath, [scanner, root], { encoding: "utf8" });
}

withRepo({
  ".env.example": "DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DB\nOPENAI_API_KEY=replace-with-key\n",
  "safe.txt": "No credentials here.\n",
}, (root) => {
  const result = scan(root);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /SECRET_EXPOSURE_POLICY_PASS/);
});

withRepo({ ".env": "EXAMPLE=value\n" }, (root) => {
  const result = scan(root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /tracked environment file is forbidden/);
});

withRepo({
  "leak.txt": `OPENAI_API_KEY=${"sk-" + "A".repeat(32)}\n`,
}, (root) => {
  const result = scan(root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /openai-key detector matched/);
  assert.doesNotMatch(result.stderr, /A{20,}/);
});

withRepo({
  "db.txt": `DATABASE_URL=${"postgresql://user:" + "S".repeat(24) + "@db.example.net/app"}\n`,
}, (root) => {
  const result = scan(root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /credentialed-database-url detector matched/);
  assert.doesNotMatch(result.stderr, /S{20,}/);
});

console.log("SECRET_EXPOSURE_POLICY_TEST_PASS");
