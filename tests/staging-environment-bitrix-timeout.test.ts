import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import {
  buildStagingEnvironmentInventory,
  STAGING_ENVIRONMENT_PHASES,
} from "../scripts/staging-environment-inventory";

const webhookSecret = "bitrix-timeout-test-secret";
const fingerprint = createHash("sha256").update(webhookSecret, "utf8").digest("hex");
const validFieldMap =
  "caseNumber=ufCrmCaseNumber,planCode=ufCrmPlanCode,stageCode=ufCrmStageCode,status=ufCrmStatus";

const baseBitrixEnv = {
  IB_RUNTIME_TARGET: "staging",
  IB_BITRIX24_TARGET: "staging",
  BITRIX24_PORTAL_ORIGIN: "https://stage.bitrix24.test",
  IB_BITRIX24_ALLOWED_HOST: "stage.bitrix24.test",
  BITRIX24_WEBHOOK_USER_ID: "42",
  BITRIX24_WEBHOOK_SECRET: webhookSecret,
  BITRIX24_CASE_ENTITY_TYPE_ID: "123",
  BITRIX24_CASE_FIELD_MAP: validFieldMap,
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
assert.equal(bitrix24().ready, true, "valid Bitrix schema with absent timeout must preserve runtime default readiness");

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

for (const value of ["0", "2147483648", "1.5", "01", "abc"]) {
  const phase = bitrix24({ BITRIX24_CASE_ENTITY_TYPE_ID: value });
  assert.equal(phase.ready, false, `runtime-rejected Bitrix entity type ${value} must fail inventory`);
  assert.ok(phase.invalidOrInconsistent.includes("BITRIX24_CASE_ENTITY_TYPE_ID"));
  assert.equal(JSON.stringify(phase).includes(`\"${value}\"`), false);
}

for (const value of ["1", "2147483647"]) {
  const phase = bitrix24({ BITRIX24_CASE_ENTITY_TYPE_ID: value });
  assert.equal(phase.ready, true, `runtime-supported Bitrix entity type ${value} must be ready`);
}

const invalidFieldMaps = [
  "{}",
  "caseNumber=ufCase,planCode=ufPlan,stageCode=ufStage",
  "caseNumber=ufCase,planCode=ufPlan,stageCode=ufStage,status",
  "caseNumber=ufCase,planCode=ufPlan,stageCode=ufStage,unknown=ufStatus",
  "caseNumber=ufCase,caseNumber=ufPlan,stageCode=ufStage,status=ufStatus",
  "caseNumber=ufSame,planCode=ufSame,stageCode=ufStage,status=ufStatus",
  "caseNumber=constructor,planCode=ufPlan,stageCode=ufStage,status=ufStatus",
  "caseNumber=9invalid,planCode=ufPlan,stageCode=ufStage,status=ufStatus",
] as const;

for (const value of invalidFieldMaps) {
  const phase = bitrix24({ BITRIX24_CASE_FIELD_MAP: value });
  assert.equal(phase.ready, false, "runtime-rejected Bitrix field map must fail inventory");
  assert.ok(phase.invalidOrInconsistent.includes("BITRIX24_CASE_FIELD_MAP"));
  assert.equal(JSON.stringify(phase).includes(value), false, "inventory must not expose Bitrix field-map values");
}

console.log("STAGING_ENVIRONMENT_BITRIX_TIMEOUT_TEST_PASS");
