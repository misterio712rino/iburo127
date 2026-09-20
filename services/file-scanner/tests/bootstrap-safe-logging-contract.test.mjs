import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const bootstrap = readFileSync(
  resolve(process.cwd(), "services/file-scanner/deploy/bootstrap-staging-runtime.sh"),
  "utf8",
);

test("staging scanner bootstrap fails closed without dumping unverified container logs", () => {
  assert.match(bootstrap, /STAGING_FILE_SCANNER_LOCAL_HEALTH_TIMEOUT/);
  assert.match(bootstrap, /fail "local scanner health timeout"/);
  assert.doesNotMatch(bootstrap, /\bdocker\s+(?:container\s+)?logs\b/);
});
