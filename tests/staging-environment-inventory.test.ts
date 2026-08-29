import assert from "node:assert/strict";

import {
  buildStagingEnvironmentInventory,
  STAGING_ENVIRONMENT_PHASES,
} from "../scripts/staging-environment-inventory";

const secretValues = {
  IB_RUNTIME_TARGET: "staging",
  DATABASE_URL: "postgresql://stage.pg.internal:5432/iburo_stage",
  IB_DB_TARGET: "staging",
  IB_STAGING_DATABASE_HOST: "stage.pg.internal",
  IB_STAGING_DATABASE_NAME: "iburo_stage",
  IB_STAGING_DATABASE_USER: "stage_user",
  IB_STAGING_BETTER_AUTH_SCHEMA: "public",
  BETTER_AUTH_SECRET: "better-auth-secret-that-must-never-print",
  BETTER_AUTH_URL: "https://stage.iburo.invalid",
  IB_STAGING_BASE_URL: "https://stage.iburo.invalid",
  IB_STAGING_AUTH_FLOW_TARGET: "staging",
  IB_STAGING_AUTH_FLOW_CONFIRM: "AUTH-FLOW:stage.iburo.invalid",
  IB_STAGING_CLIENT_EMAIL: "client@stage.iburo.invalid",
  IB_STAGING_CLIENT_PASSWORD: "client-password-that-must-never-print",
  IB_STAGING_LAWYER_EMAIL: "lawyer@stage.iburo.invalid",
  IB_STAGING_LAWYER_PASSWORD: "lawyer-password-that-must-never-print",
  IB_STAGING_LAWYER_TOTP_SECRET: "JBSWY3DPEHPK3PXP",
  IB_STAGING_MANAGER_EMAIL: "manager@stage.iburo.invalid",
  IB_STAGING_MANAGER_PASSWORD: "manager-password-that-must-never-print",
  IB_STAGING_MANAGER_TOTP_SECRET: "KRSXG5DSNFXGOIDB",
  IB_STAGING_CLIENT_CASE_NUMBER: "STAGE-CLIENT-001",
  IB_STAGING_LAWYER_CASE_NUMBER: "STAGE-LAWYER-001",
  IB_STAGING_CLIENT_AI_CASE_NUMBER: "STAGE-CLIENT-AI-001",
  IB_STAGING_CLIENT_NO_AI_CASE_NUMBER: "STAGE-CLIENT-NOAI-001",
  IB_STAGING_MUTATION_TARGET: "staging",
  IB_STAGING_MUTATION_CONFIRM: "MUTATE:stage.iburo.invalid",
  IB_STAGING_MUTATION_CASE_NUMBER: "STAGE-MUTATION-001",
  IB_STAGING_MUTATION_TASK_ID: "stage-task-id",
  OPENAI_API_KEY: "openai-secret-that-must-never-print",
  YANDEX_STORAGE_SECRET_ACCESS_KEY: "storage-secret-that-must-never-print",
  IB_FILE_SCANNER_SECRET: "scanner-secret-that-must-never-print",
  BITRIX24_WEBHOOK_SECRET: "bitrix-secret-that-must-never-print",
  YANDEX_POSTBOX_SECRET_ACCESS_KEY: "postbox-secret-that-must-never-print",
  IB_MAINTENANCE_SECRET: "maintenance-secret-that-must-never-print",
} as const;

const inventory = buildStagingEnvironmentInventory(secretValues);
assert.equal(inventory.networkAccessed, false);
assert.equal(inventory.valuesPrinted, false);
assert.equal(inventory.phases.runtime.ready, true);
assert.deepEqual(STAGING_ENVIRONMENT_PHASES.runtime, ["IB_RUNTIME_TARGET"]);
assert.equal(inventory.phases.database.ready, true);
assert.equal(inventory.phases.database.missingOrPlaceholder.length, 0);
assert.equal(inventory.phases.authFlow.ready, true);
assert.equal(inventory.phases.authFlow.missingOrPlaceholder.length, 0);
assert.equal(inventory.phases.applicationE2e.ready, true);
assert.equal(inventory.phases.applicationE2e.missingOrPlaceholder.length, 0);

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
  ["BETTER_AUTH_SECRET", "BETTER_AUTH_URL"].sort(),
);
assert.equal(placeholderInventory.phases.authFlow.ready, false);
assert.ok(
  placeholderInventory.phases.authFlow.missingOrPlaceholder.includes("IB_STAGING_AUTH_FLOW_CONFIRM"),
);
assert.equal(placeholderInventory.phases.applicationE2e.ready, false);
assert.ok(
  placeholderInventory.phases.applicationE2e.missingOrPlaceholder.includes("IB_STAGING_CLIENT_EMAIL"),
);

for (const [phase, required] of Object.entries(STAGING_ENVIRONMENT_PHASES)) {
  assert.ok(required.length > 0, `${phase} inventory must have at least one required variable`);
}

console.log("STAGING_ENVIRONMENT_INVENTORY_TEST_PASS");
