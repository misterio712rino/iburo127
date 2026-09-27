import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = process.cwd();
const bootstrap = readFileSync(
  resolve(root, "services/file-scanner/deploy/bootstrap-staging-runtime.sh"),
  "utf8",
);
const entrypoint = readFileSync(
  resolve(root, "services/file-scanner/entrypoint.sh"),
  "utf8",
);

test("bootstrap wait covers one bounded FreshClam retry cycle", () => {
  assert.match(bootstrap, /for _attempt in \$\(seq 1 960\); do/);
  assert.match(bootstrap, /sleep 5/);
  assert.match(entrypoint, /timeout 420s gosu clamav freshclam/);
  assert.match(entrypoint, /sleep 3600/);
  // 960 * 5s = 80m, longer than 420s + 3600s + 420s = 74m.
  assert.ok(960 * 5 > 420 + 3600 + 420);
});

test("bootstrap aborts terminal states and sustained restart loops without logs", () => {
  assert.match(bootstrap, /exited\|dead\|removing/);
  assert.match(bootstrap, /restart_observations=\$\(\(restart_observations \+ 1\)\)/);
  assert.match(bootstrap, /restart_observations" -ge 12/);
  assert.match(bootstrap, /STAGING_FILE_SCANNER_LOCAL_HEALTH_ABORT_CONTAINER_RESTART_LOOP/);
  assert.doesNotMatch(bootstrap, /\bdocker\s+(?:container\s+)?logs\b/);
});
