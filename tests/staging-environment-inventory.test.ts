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
  BITRIX24_CASE_FIELD_MAP: "{}",
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
    `active application E2E inventory must not require pre-issued ${cookieName}`,
  );
}
for (const freshCredential of [
  "IB_STAGING_CLIENT_EMAIL",
  "IB_STAGING_CLIENT_PASSWORD",
  "IB_STAGING_LAWYER_TOTP_SECRET",
  "IB_STAGING_MANAGER_TOTP_SECRET",
]) {
  assert.equal(
    applicationE2eRequirements.includes(freshCredential),
    true,
    `active application E2E inventory must require ${freshCredential}`,
  );
}

const conflictInventory = buildStagingEnvironmentInventory({
  ...secretValues,
  IB_RUNTIME_TARGET: "production",
  BETTER_AUTH_URL: "https://prod.iburo.test",
  IB_STAGING_MUTATION_TARGET: "production",
  IB_AI_TARGET: "production",
  YANDEX_STORAGE_BUCKET: "wrong-stage-bucket",
});
assert.equal(conflictInventory.phases.runtime.ready, false);
assert.deepEqual(conflictInventory.phases.runtime.invalidOrInconsistent, ["IB_RUNTIME_TARGET"]);
assert.equal(conflictInventory.phases.auth.ready, false);
assert.ok(conflictInventory.phases.auth.invalidOrInconsistent.includes("BETTER_AUTH_URL"));
assert.ok(conflictInventory.phases.auth.invalidOrInconsistent.includes("IB_RUNTIME_TARGET"));
assert.equal(conflictInventory.phases.applicationE2e.ready, false);
assert.ok(
  conflictInventory.phases.applicationE2e.invalidOrInconsistent.includes("IB_STAGING_MUTATION_TARGET"),
);
assert.equal(conflictInventory.phases.openai.ready, false);
assert.deepEqual(conflictInventory.phases.openai.invalidOrInconsistent, ["IB_AI_TARGET"]);
assert.equal(conflictInventory.phases.storage.ready, false);
assert.ok(conflictInventory.phases.storage.invalidOrInconsistent.includes("YANDEX_STORAGE_BUCKET"));
assert.equal(conflictInventory.phases.scanner.ready, false);
assert.ok(conflictInventory.phases.scanner.invalidOrInconsistent.includes("YANDEX_STORAGE_BUCKET"));
assert.equal(conflictInventory.phases.maintenance.ready, false);
assert.ok(conflictInventory.phases.maintenance.invalidOrInconsistent.includes("BETTER_AUTH_URL"));

const databaseConflict = buildStagingEnvironmentInventory({
  ...secretValues,
  DATABASE_URL: "postgresql://other_user@wrong.pg.internal:5432/wrong_database",
});
assert.equal(databaseConflict.phases.database.ready, false);
assert.deepEqual(databaseConflict.phases.database.missingOrPlaceholder, []);
for (const name of [
  "DATABASE_URL",
  "IB_STAGING_DATABASE_HOST",
  "IB_STAGING_DATABASE_NAME",
  "IB_STAGING_DATABASE_USER",
]) {
  assert.ok(
    databaseConflict.phases.database.invalidOrInconsistent.includes(name),
    `database inventory must flag ${name} on identity mismatch`,
  );
}

const invalidDatabaseUrl = buildStagingEnvironmentInventory({
  ...secretValues,
  DATABASE_URL: "https://stage.pg.internal/iburo_stage",
});
assert.equal(invalidDatabaseUrl.phases.database.ready, false);
assert.deepEqual(invalidDatabaseUrl.phases.database.invalidOrInconsistent, ["DATABASE_URL"]);

const malformedEncodedDatabase = buildStagingEnvironmentInventory({
  ...secretValues,
  DATABASE_URL: "postgresql://stage_user@stage.pg.internal:5432/%ZZ",
});
assert.equal(malformedEncodedDatabase.phases.database.ready, false);
assert.ok(malformedEncodedDatabase.phases.database.invalidOrInconsistent.includes("DATABASE_URL"));

const secretIdentityConflict = buildStagingEnvironmentInventory({
  ...secretValues,
  IB_STAGING_OPENAI_KEY_SHA256: "0".repeat(64),
  IB_STAGING_FILE_SCANNER_SECRET_SHA256: "1".repeat(64),
  IB_STAGING_BITRIX24_WEBHOOK_SECRET_SHA256: "2".repeat(64),
});
for (const [phase, secretName, fingerprintName] of [
  ["openai", "OPENAI_API_KEY", "IB_STAGING_OPENAI_KEY_SHA256"],
  ["scanner", "IB_FILE_SCANNER_SECRET", "IB_STAGING_FILE_SCANNER_SECRET_SHA256"],
  ["bitrix24", "BITRIX24_WEBHOOK_SECRET", "IB_STAGING_BITRIX24_WEBHOOK_SECRET_SHA256"],
] as const) {
  assert.equal(secretIdentityConflict.phases[phase].ready, false);
  assert.ok(secretIdentityConflict.phases[phase].invalidOrInconsistent.includes(secretName));
  assert.ok(secretIdentityConflict.phases[phase].invalidOrInconsistent.includes(fingerprintName));
}

const confirmationConflict = buildStagingEnvironmentInventory({
  ...secretValues,
  IB_STAGING_AI_CONFIRM: "AI-SMOKE:wrong",
  IB_STAGING_FILE_SCANNER_CONFIRM: "FILE-SCANNER-SMOKE:wrong",
  IB_STAGING_BITRIX24_CONFIRM: "BITRIX-VERIFY:wrong",
});
assert.deepEqual(confirmationConflict.phases.openai.invalidOrInconsistent, ["IB_STAGING_AI_CONFIRM"]);
assert.deepEqual(confirmationConflict.phases.scanner.invalidOrInconsistent, ["IB_STAGING_FILE_SCANNER_CONFIRM"]);
assert.deepEqual(confirmationConflict.phases.bitrix24.invalidOrInconsistent, ["IB_STAGING_BITRIX24_CONFIRM"]);

const invalidFingerprints = buildStagingEnvironmentInventory({
  ...secretValues,
  IB_STAGING_OPENAI_KEY_SHA256: "not-a-sha256",
  IB_STAGING_FILE_SCANNER_SECRET_SHA256: "not-a-sha256",
  IB_STAGING_BITRIX24_WEBHOOK_SECRET_SHA256: "not-a-sha256",
});
assert.ok(invalidFingerprints.phases.openai.invalidOrInconsistent.includes("IB_STAGING_OPENAI_KEY_SHA256"));
assert.ok(invalidFingerprints.phases.scanner.invalidOrInconsistent.includes("IB_STAGING_FILE_SCANNER_SECRET_SHA256"));
assert.ok(invalidFingerprints.phases.bitrix24.invalidOrInconsistent.includes("IB_STAGING_BITRIX24_WEBHOOK_SECRET_SHA256"));

const shortSecretInventory = buildStagingEnvironmentInventory({
  ...secretValues,
  BETTER_AUTH_SECRET: "too-short-auth-secret",
  IB_MAINTENANCE_SECRET: "too-short-maintenance-secret",
});
assert.deepEqual(shortSecretInventory.phases.auth.invalidOrInconsistent, ["BETTER_AUTH_SECRET"]);
assert.deepEqual(shortSecretInventory.phases.maintenance.invalidOrInconsistent, ["IB_MAINTENANCE_SECRET"]);

const unsafeScannerKeys = buildStagingEnvironmentInventory({
  ...secretValues,
  IB_STAGING_FILE_SCANNER_CLEAN_OBJECT_KEY: "security-fixtures/file-scanner/../escape.txt",
  IB_STAGING_FILE_SCANNER_MALICIOUS_OBJECT_KEY: "wrong-prefix/malicious.txt",
});
assert.equal(unsafeScannerKeys.phases.scanner.ready, false);
assert.ok(
  unsafeScannerKeys.phases.scanner.invalidOrInconsistent.includes(
    "IB_STAGING_FILE_SCANNER_CLEAN_OBJECT_KEY",
  ),
);
assert.ok(
  unsafeScannerKeys.phases.scanner.invalidOrInconsistent.includes(
    "IB_STAGING_FILE_SCANNER_MALICIOUS_OBJECT_KEY",
  ),
);

const duplicateScannerKeys = buildStagingEnvironmentInventory({
  ...secretValues,
  IB_STAGING_FILE_SCANNER_MALICIOUS_OBJECT_KEY:
    secretValues.IB_STAGING_FILE_SCANNER_CLEAN_OBJECT_KEY,
});
assert.equal(duplicateScannerKeys.phases.scanner.ready, false);
assert.ok(
  duplicateScannerKeys.phases.scanner.invalidOrInconsistent.includes(
    "IB_STAGING_FILE_SCANNER_CLEAN_OBJECT_KEY",
  ),
);
assert.ok(
  duplicateScannerKeys.phases.scanner.invalidOrInconsistent.includes(
    "IB_STAGING_FILE_SCANNER_MALICIOUS_OBJECT_KEY",
  ),
);

const serialized = JSON.stringify(inventory);
for (const value of Object.values(secretValues)) {
  assert.equal(
    serialized.includes(value),
    false,
    "inventory output must never contain environment values",
  );
}

const placeholderInventory = buildStagingEnvironmentInventory({
  DATABASE_URL: "replace-with-staging-database-url",
  IB_DB_TARGET: "staging",
  IB_STAGING_DATABASE_HOST: "staging.pg.example.net",
  IB_STAGING_DATABASE_NAME: "iburo_staging",
  IB_STAGING_DATABASE_USER: "iburo_staging_user",
  IB_STAGING_BETTER_AUTH_SCHEMA: "public",
  BETTER_AUTH_SECRET: "replace-with-a-long-random-secret",
  BETTER_AUTH_URL: "https://app.example.com",
});

assert.equal(placeholderInventory.phases.runtime.ready, false);
assert.deepEqual(placeholderInventory.phases.runtime.missingOrPlaceholder, ["IB_RUNTIME_TARGET"]);
assert.equal(placeholderInventory.phases.database.ready, false);
assert.deepEqual(
  placeholderInventory.phases.database.missingOrPlaceholder.sort(),
  ["DATABASE_URL", "IB_STAGING_DATABASE_HOST"].sort(),
);
assert.equal(placeholderInventory.phases.auth.ready, false);
assert.deepEqual(
  placeholderInventory.phases.auth.missingOrPlaceholder.sort(),
  ["IB_RUNTIME_TARGET", "BETTER_AUTH_SECRET", "BETTER_AUTH_URL", "IB_STAGING_BASE_URL"].sort(),
);
assert.equal(placeholderInventory.phases.authFlow.ready, false);
assert.ok(
  placeholderInventory.phases.authFlow.missingOrPlaceholder.includes("IB_STAGING_AUTH_FLOW_CONFIRM"),
);
assert.equal(placeholderInventory.phases.applicationE2e.ready, false);
assert.ok(
  placeholderInventory.phases.applicationE2e.missingOrPlaceholder.includes("IB_STAGING_CLIENT_EMAIL"),
);
assert.equal(placeholderInventory.phases.maintenance.ready, false);
assert.deepEqual(
  placeholderInventory.phases.maintenance.missingOrPlaceholder.sort(),
  [
    "IB_RUNTIME_TARGET",
    "BETTER_AUTH_URL",
    "IB_STAGING_BASE_URL",
    "IB_MAINTENANCE_SECRET",
    "IB_MAINTENANCE_BASE_URL",
  ].sort(),
);

for (const [phase, required] of Object.entries(STAGING_ENVIRONMENT_PHASES)) {
  assert.ok(required.length > 0, `${phase} inventory must have at least one required variable`);
}

console.log("STAGING_ENVIRONMENT_INVENTORY_TEST_PASS");
