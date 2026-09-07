import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import { buildStagingEnvironmentInventory } from "../scripts/staging-environment-inventory";

const scannerSecret = "scanner-staging-timeout-regression-secret-123456";
const scannerFingerprint = createHash("sha256").update(scannerSecret, "utf8").digest("hex");

const baseEnv = {
  IB_RUNTIME_TARGET: "staging",
  IB_FILE_SCANNER_TARGET: "staging",
  IB_FILE_SCANNER_ORIGIN: "https://scanner-staging.iburo.test",
  IB_FILE_SCANNER_SECRET: scannerSecret,
  IB_STAGING_FILE_SCANNER_ORIGIN: "https://scanner-staging.iburo.test",
  IB_STAGING_FILE_SCANNER_SECRET_SHA256: scannerFingerprint,
  IB_STAGING_FILE_SCANNER_CLEAN_OBJECT_KEY: "security-fixtures/file-scanner/clean.txt",
  IB_STAGING_FILE_SCANNER_MALICIOUS_OBJECT_KEY: "security-fixtures/file-scanner/malicious.txt",
  IB_STAGING_FILE_SCANNER_CONFIRM: `FILE-SCANNER-SMOKE:scanner-staging.iburo.test:iburo-stage-private:${scannerFingerprint}`,
  IB_STORAGE_TARGET: "staging",
  IB_STAGING_STORAGE_BUCKET: "iburo-stage-private",
  IB_STAGING_STORAGE_ACCESS_KEY_ID: "stage-storage-access-key",
  YANDEX_STORAGE_BUCKET: "iburo-stage-private",
  YANDEX_STORAGE_ACCESS_KEY_ID: "stage-storage-access-key",
  YANDEX_STORAGE_SECRET_ACCESS_KEY: "storage-secret-that-must-never-print",
} as const;

for (const timeout of [undefined, "1000", "120000"] as const) {
  const inventory = buildStagingEnvironmentInventory({
    ...baseEnv,
    ...(timeout === undefined ? {} : { IB_FILE_SCANNER_REQUEST_TIMEOUT_MS: timeout }),
  });
  assert.equal(inventory.phases.scanner.ready, true, `timeout ${timeout ?? "absent"} must be accepted`);
  assert.deepEqual(inventory.phases.scanner.invalidOrInconsistent, []);
}

for (const timeout of ["999", "120001", "1.5", "abc"] as const) {
  const inventory = buildStagingEnvironmentInventory({
    ...baseEnv,
    IB_FILE_SCANNER_REQUEST_TIMEOUT_MS: timeout,
  });
  assert.equal(inventory.phases.scanner.ready, false, `timeout ${timeout} must fail closed`);
  assert.ok(
    inventory.phases.scanner.invalidOrInconsistent.includes("IB_FILE_SCANNER_REQUEST_TIMEOUT_MS"),
    `timeout ${timeout} must be reported by variable name only`,
  );
  assert.equal(JSON.stringify(inventory).includes(timeout), false, "inventory must not expose timeout values");
}

const redactionSentinel = "54321";
const redactedInventory = buildStagingEnvironmentInventory({
  ...baseEnv,
  IB_FILE_SCANNER_REQUEST_TIMEOUT_MS: redactionSentinel,
});
assert.equal(redactedInventory.phases.scanner.ready, true);
assert.equal(JSON.stringify(redactedInventory).includes(redactionSentinel), false);

console.log("STAGING_ENVIRONMENT_SCANNER_TIMEOUT_TEST_PASS");
