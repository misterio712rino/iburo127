import assert from "node:assert/strict";

import {
  buildStagingEnvironmentInventory,
  STAGING_ENVIRONMENT_PHASES,
} from "../scripts/staging-environment-inventory";

const openAiFingerprint = "805bb5b5affe92b006f210a21cb86312f42bb2b4a318f192f8638750013c588f";
const scannerFingerprint = "22019c0cb7a42ff3ea5487f63789a42d9e63d8a861f8363923707551ae6017a6";
const bitrixFingerprint = "c8407c6caf027b8f9ed7a2d90a218f15d540d15792543c5d1392cb1cb26e64dc";

const secretValues = {
  IB_RUNTIME_TARGET: "staging",
  DATABASE_URL: "postgresql://stage_user@stage.pg.internal:5432/iburo_stage",
  IB_DB_TARGET: "staging",
  IB_STAGING_DATABASE_HOST: "stage.pg.internal",
  IB_STAGING_DATABASE_NAME: "iburo_stage",
  IB_STAGING_DATABASE_USER: "stage_user",
  IB_STAGING_BETTER_AUTH_SCHEMA: "public",
  IB_STAGING_CLIENT_USER_ID: "11111111-1111-4111-8111-111111111111",
  IB_STAGING_CLIENT_SUBJECT: "better-auth-client-subject",
  IB_STAGING_LAWYER_USER_ID: "22222222-2222-4222-8222-222222222222",
  IB_STAGING_LAWYER_SUBJECT: "better-auth-lawyer-subject",
  IB_STAGING_MANAGER_USER_ID: "33333333-3333-4333-8333-333333333333",
  IB_STAGING_MANAGER_SUBJECT: "better-auth-manager-subject",
  BETTER_AUTH_SECRET: "better-auth-secret-that-must-never-print",
  BETTER_AUTH_URL: "https://stage.iburo.test",
  IB_STAGING_BASE_URL: "https://stage.iburo.test",
  IB_STAGING_AUTH_FLOW_TARGET: "staging",
  IB_STAGING_AUTH_FLOW_CONFIRM: "AUTH-FLOW:stage.iburo.test",
  IB_STAGING_CLIENT_EMAIL: "client@stage.iburo.test",
  IB_STAGING_CLIENT_PASSWORD: "client-password-that-must-never-print",
  IB_STAGING_LAWYER_EMAIL: "lawyer@stage.iburo.test",
  IB_STAGING_LAWYER_PASSWORD: "lawyer-password-that-must-never-print",
  IB_STAGING_LAWYER_TOTP_SECRET: "JBSWY3DPEHPK3PXP",
  IB_STAGING_MANAGER_EMAIL: "manager@stage.iburo.test",
  IB_STAGING_MANAGER_PASSWORD: "manager-password-that-must-never-print",
  IB_STAGING_MANAGER_TOTP_SECRET: "KRSXG5DSNFXGOIDB",
  IB_STAGING_CLIENT_CASE_NUMBER: "STAGE-CLIENT-001",
  IB_STAGING_LAWYER_CASE_NUMBER: "STAGE-LAWYER-001",
  IB_STAGING_CLIENT_AI_CASE_NUMBER: "STAGE-CLIENT-AI-001",
  IB_STAGING_CLIENT_NO_AI_CASE_NUMBER: "STAGE-CLIENT-NOAI-001",
  IB_STAGING_MUTATION_TARGET: "staging",
  IB_STAGING_MUTATION_CONFIRM: "MUTATE:stage.iburo.test",
  IB_STAGING_MUTATION_CASE_NUMBER: "STAGE-MUTATION-001",
  IB_STAGING_MUTATION_TASK_ID: "stage-task-id",
  IB_STORAGE_TARGET: "staging",
  IB_STAGING_STORAGE_BUCKET: "iburo-stage-private",
  IB_STAGING_STORAGE_ALLOWED_ORIGIN: "https://stage.iburo.test",
  IB_STAGING_STORAGE_ACCESS_KEY_ID: "stage-storage-access-key",
  YANDEX_STORAGE_BUCKET: "iburo-stage-private",
  YANDEX_STORAGE_ACCESS_KEY_ID: "stage-storage-access-key",
  YANDEX_STORAGE_SECRET_ACCESS_KEY: "storage-secret-that-must-never-print",
  IB_FILE_SCANNER_TARGET: "staging",
  IB_FILE_SCANNER_ORIGIN: "https://scanner.stage.iburo.test",
  IB_FILE_SCANNER_SECRET: "scanner-secret-that-must-never-print-123456",
  IB_STAGING_FILE_SCANNER_ORIGIN: "https://scanner.stage.iburo.test",
  IB_STAGING_FILE_SCANNER_SECRET_SHA256: scannerFingerprint,
  IB_STAGING_FILE_SCANNER_CLEAN_OBJECT_KEY: "security-fixtures/file-scanner/clean.txt",
  IB_STAGING_FILE_SCANNER_MALICIOUS_OBJECT_KEY: "security-fixtures/file-scanner/malicious.txt",
  IB_STAGING_FILE_SCANNER_CONFIRM: `FILE-SCANNER-SMOKE:scanner.stage.iburo.test:iburo-stage-private:${scannerFingerprint}`,
  IB_EMAIL_TARGET: "staging",
  YANDEX_POSTBOX_FROM_EMAIL: "stage@iburo.test",
  YANDEX_POSTBOX_ACCESS_KEY_ID: "stage-postbox-access-key",
  YANDEX_POSTBOX_SECRET_ACCESS_KEY: "postbox-secret-that-must-never-print",
  IB_STAGING_POSTBOX_FROM_EMAIL: "stage@iburo.test",
  IB_STAGING_POSTBOX_ACCESS_KEY_ID: "stage-postbox-access-key",
  IB_STAGING_POSTBOX_CONFIRM: "SIMULATOR:stage@iburo.test",
  IB_AI_TARGET: "staging",
  OPENAI_API_KEY: "openai-secret-that-must-never-print",
  IB_AI_OPENAI_MODEL: "gpt-stage-model",
  IB_STAGING_OPENAI_MODEL: "gpt-stage-model",
  IB_STAGING_OPENAI_KEY_SHA256: openAiFingerprint,
  IB_STAGING_AI_CONFIRM: `AI-SMOKE:gpt-stage-model:${openAiFingerprint}`,
  IB_BITRIX24_TARGET: "staging",
  BITRIX24_PORTAL_ORIGIN: "https://stage.bitrix24.test",
  IB_BITRIX24_ALLOWED_HOST: "stage.bitrix24.test",
  BITRIX24_WEBHOOK_USER_ID: "42",
  BITRIX24_WEBHOOK_SECRET: "bitrix-secret-that-must-never-print",
  BITRIX24_CASE_ENTITY_TYPE_ID: "123",
  BITRIX24_CASE_FIELD_MAP:
    "caseNumber=ufCrmCaseNumber,planCode=ufCrmPlanCode,stageCode=ufCrmStageCode,status=ufCrmStatus",
  IB_STAGING_BITRIX24_PORTAL_ORIGIN: "https://stage.bitrix24.test",
  IB_STAGING_BITRIX24_WEBHOOK_USER_ID: "42",
  IB_STAGING_BITRIX24_WEBHOOK_SECRET_SHA256: bitrixFingerprint,
  IB_STAGING_BITRIX24_CONFIRM: `BITRIX-VERIFY:stage.bitrix24.test:42:${bitrixFingerprint}`,
  IB_MAINTENANCE_SECRET: "maintenance-secret-that-must-never-print-123456",
  IB_MAINTENANCE_BASE_URL: "https://stage.iburo.test",
} as const;

const inventory = buildStagingEnvironmentInventory(secretValues);
assert.equal(inventory.networkAccessed, false);
assert.equal(inventory.valuesPrinted, false);
for (const [phase, result] of Object.entries(inventory.phases)) {
  assert.equal(result.ready, true, `${phase} must be ready for a consistent staging fixture`);
  assert.deepEqual(result.missingOrPlaceholder, []);
  assert.deepEqual(result.invalidOrInconsistent, []);
}

assert.deepEqual(STAGING_ENVIRONMENT_PHASES.runtime, ["IB_RUNTIME_TARGET"]);
assert.deepEqual(STAGING_ENVIRONMENT_PHASES.maintenance, [
  "IB_RUNTIME_TARGET",
  "BETTER_AUTH_URL",
  "IB_STAGING_BASE_URL",
  "IB_MAINTENANCE_SECRET",
  "IB_MAINTENANCE_BASE_URL",
]);
assert.deepEqual(STAGING_ENVIRONMENT_PHASES.authz, [
  "DATABASE_URL",
  "IB_DB_TARGET",
  "IB_STAGING_DATABASE_HOST",
  "IB_STAGING_DATABASE_NAME",
  "IB_STAGING_DATABASE_USER",
  "IB_STAGING_CLIENT_USER_ID",
  "IB_STAGING_CLIENT_SUBJECT",
  "IB_STAGING_LAWYER_USER_ID",
  "IB_STAGING_LAWYER_SUBJECT",
  "IB_STAGING_MANAGER_USER_ID",
  "IB_STAGING_MANAGER_SUBJECT",
]);
for (const phase of ["scanner", "postbox", "openai", "bitrix24"] as const) {
  assert.equal(
    (STAGING_ENVIRONMENT_PHASES[phase] as readonly string[]).includes("IB_RUNTIME_TARGET"),
    true,
    `${phase} inventory must require the global staging runtime target`,
  );
}

const scannerRequirements = STAGING_ENVIRONMENT_PHASES.scanner as readonly string[];
for (const storageRequirement of [
  "IB_STORAGE_TARGET",
  "IB_STAGING_STORAGE_BUCKET",
  "IB_STAGING_STORAGE_ACCESS_KEY_ID",
  "YANDEX_STORAGE_BUCKET",
  "YANDEX_STORAGE_ACCESS_KEY_ID",
  "YANDEX_STORAGE_SECRET_ACCESS_KEY",
]) {
  assert.equal(
    scannerRequirements.includes(storageRequirement),
    true,
    `scanner inventory must require ${storageRequirement}`,
  );
}

const applicationE2eRequirements =
  STAGING_ENVIRONMENT_PHASES.applicationE2e as readonly string[];
for (const cookieName of [
  "IB_STAGING_CLIENT_COOKIE",
  "IB_STAGING_LAWYER_COOKIE",
  "IB_STAGING_MANAGER_COOKIE",
]) {
  assert.equal(
    applicationE2eRequirements.includes(cookieName),
    false,
    `${cookieName} must not be a static application E2E requirement because core sessions are created dynamically`,
  );
}

const missingAuthz = buildStagingEnvironmentInventory({
  ...secretValues,
  IB_STAGING_MANAGER_SUBJECT: undefined,
}).phases.authz;
assert.equal(missingAuthz.ready, false);
assert.deepEqual(missingAuthz.missingOrPlaceholder, ["IB_STAGING_MANAGER_SUBJECT"]);

const collapsedAuthz = buildStagingEnvironmentInventory({
  ...secretValues,
  IB_STAGING_LAWYER_USER_ID: secretValues.IB_STAGING_CLIENT_USER_ID,
}).phases.authz;
assert.equal(collapsedAuthz.ready, false);
for (const name of [
  "IB_STAGING_CLIENT_USER_ID",
  "IB_STAGING_CLIENT_SUBJECT",
  "IB_STAGING_LAWYER_USER_ID",
  "IB_STAGING_LAWYER_SUBJECT",
  "IB_STAGING_MANAGER_USER_ID",
  "IB_STAGING_MANAGER_SUBJECT",
]) {
  assert.ok(collapsedAuthz.invalidOrInconsistent.includes(name));
}

const malformedAuthz = buildStagingEnvironmentInventory({
  ...secretValues,
  IB_STAGING_CLIENT_USER_ID: "not-a-uuid",
}).phases.authz;
assert.equal(malformedAuthz.ready, false);
assert.ok(malformedAuthz.invalidOrInconsistent.includes("IB_STAGING_CLIENT_USER_ID"));

const invalidDatabaseAuthSchema = buildStagingEnvironmentInventory({
  ...secretValues,
  IB_STAGING_BETTER_AUTH_SCHEMA: "auth",
}).phases.database;
assert.equal(invalidDatabaseAuthSchema.ready, false);
assert.ok(
  invalidDatabaseAuthSchema.invalidOrInconsistent.includes("IB_STAGING_BETTER_AUTH_SCHEMA"),
);

const invalidAuthzAuthSchema = buildStagingEnvironmentInventory({
  ...secretValues,
  IB_STAGING_BETTER_AUTH_SCHEMA: "auth",
}).phases.authz;
assert.equal(invalidAuthzAuthSchema.ready, false);
assert.ok(
  invalidAuthzAuthSchema.invalidOrInconsistent.includes("IB_STAGING_BETTER_AUTH_SCHEMA"),
);

const optionalAuthzAuthSchema = buildStagingEnvironmentInventory({
  ...secretValues,
  IB_STAGING_BETTER_AUTH_SCHEMA: undefined,
}).phases.authz;
assert.equal(optionalAuthzAuthSchema.ready, true);
assert.deepEqual(optionalAuthzAuthSchema.invalidOrInconsistent, []);

const scannerAccessKeyWithControlCharacter = buildStagingEnvironmentInventory({
  ...secretValues,
  YANDEX_STORAGE_ACCESS_KEY_ID: "stage-storage\naccess-key",
  IB_STAGING_STORAGE_ACCESS_KEY_ID: "stage-storage\naccess-key",
}).phases.scanner;
assert.equal(scannerAccessKeyWithControlCharacter.ready, false);
assert.ok(
  scannerAccessKeyWithControlCharacter.invalidOrInconsistent.includes(
    "YANDEX_STORAGE_ACCESS_KEY_ID",
  ),
);

const scannerSecretWithControlCharacter = buildStagingEnvironmentInventory({
  ...secretValues,
  YANDEX_STORAGE_SECRET_ACCESS_KEY: "storage-secret\ninvalid",
}).phases.scanner;
assert.equal(scannerSecretWithControlCharacter.ready, false);
assert.ok(
  scannerSecretWithControlCharacter.invalidOrInconsistent.includes(
    "YANDEX_STORAGE_SECRET_ACCESS_KEY",
  ),
);

const serialized = JSON.stringify(inventory);
for (const [name, value] of Object.entries(secretValues)) {
  assert.equal(serialized.includes(value), false, `${name} value must not be exposed`);
}

console.log("STAGING_ENVIRONMENT_INVENTORY_TEST_PASS");
