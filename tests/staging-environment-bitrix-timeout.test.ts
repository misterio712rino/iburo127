import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import {
  buildStagingEnvironmentInventory,
  STAGING_ENVIRONMENT_PHASES,
} from "../scripts/staging-environment-inventory";

const webhookSecret = "bitrix-timeout-test-secret";
const fingerprint = createHash("sha256").update(webhookSecret, "utf8").digest("hex");

const baseBitrixEnv = {
  IB_RUNTIME_TARGET: "staging",
  IB_BITRIX24_TARGET: "staging",
  BITRIX24_PORTAL_ORIGIN: "https://stage.bitrix24.test",
  IB_BITRIX24_ALLOWED_HOST: "stage.bitrix24.test",
  BITRIX24_WEBHOOK_USER_ID: "42",
  BITRIX24_WEBHOOK_SECRET: webhookSecret,
  BITRIX24_CASE_ENTITY_TYPE_ID: "123",
  BITRIX24_CASE_FIELD_MAP: "{}",
  IB_STAGING_BITRIX24_PORTAL_ORIGIN: "https://stage.bitrix24.test",
  IB_STAGING_BITRIX24_WEBHOOK_USER_ID: "42",
  IB_STAGING_BITRIX24_WEBHOOK_SECRET_SHA256: fingerprint,
  IB_STAGING_BITRIX24_CONFIRM: `BITRIX-VERIFY:stage.bitrix24.test:42:${fingerprint}`,
} as const;

function bitrix24(overrides: Record<string, string | undefined> = {}) {
  return buildStagingEnvironmentInventory({
    ...baseBitrixEnv,
    ...overrides,
  }).phases.bitrix24;
}

assert.equal(
  (STAGING_ENVIRONMENT_PHASES.bitrix24 as readonly string[]).includes("BITRIX24_REQUEST_TIMEOUT_MS"),
  false,
  "Bitrix request timeout must remain optional because runtime has a default",
);
assert.equal(bitrix24().ready, true, "absent Bitrix timeout must preserve runtime default readiness");

for (const value of ["1000", "30000"]) {
  const phase = bitrix24({ BITRIX24_REQUEST_TIMEOUT_MS: value });
  assert.equal(phase.ready, true, `runtime-supported Bitrix timeout ${value} must be ready`);
  assert.deepEqual(phase.invalidOrInconsistent, []);
}

for (const value of ["999", "30001", "1.5", "abc"]) {
  const phase = bitrix24({ BITRIX24_REQUEST_TIMEOUT_MS: value });
  assert.equal(phase.ready, false, `runtime-rejected Bitrix timeout ${value} must fail inventory`);
  assert.deepEqual(phase.invalidOrInconsistent, ["BITRIX24_REQUEST_TIMEOUT_MS"]);
  assert.equal(
    JSON.stringify(phase).includes(value),
    false,
    "inventory must report only the variable name and never the configured timeout value",
  );
}

console.log("STAGING_ENVIRONMENT_BITRIX_TIMEOUT_TEST_PASS");
