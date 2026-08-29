import assert from "node:assert/strict";

import {
  buildStagingEnvironmentInventory,
  STAGING_ENVIRONMENT_PHASES,
} from "../scripts/staging-environment-inventory";

const secretValues = {
  DATABASE_URL: "postgresql://stage_user:super-secret-db-password@stage.pg.internal:5432/iburo_stage",
  IB_DB_TARGET: "staging",
  IB_STAGING_DATABASE_HOST: "stage.pg.internal",
  IB_STAGING_DATABASE_NAME: "iburo_stage",
  IB_STAGING_DATABASE_USER: "stage_user",
  IB_STAGING_BETTER_AUTH_SCHEMA: "public",
  BETTER_AUTH_SECRET: "better-auth-secret-that-must-never-print",
  BETTER_AUTH_URL: "https://stage.iburo.invalid",
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
assert.equal(inventory.phases.database.ready, true);
assert.equal(inventory.phases.database.missingOrPlaceholder.length, 0);

const serialized = JSON.stringify(inventory);
for (const value of Object.values(secretValues)) {
  assert.equal(
    serialized.includes(value),
    false,
    "inventory output must never contain environment values",
  );
}

const placeholderInventory = buildStagingEnvironmentInventory({
  DATABASE_URL: "postgresql://USER:PASSWORD@HOST:5432/DATABASE",
  IB_DB_TARGET: "staging",
  IB_STAGING_DATABASE_HOST: "staging.pg.example.net",
  IB_STAGING_DATABASE_NAME: "iburo_staging",
  IB_STAGING_DATABASE_USER: "iburo_staging_user",
  IB_STAGING_BETTER_AUTH_SCHEMA: "public",
  BETTER_AUTH_SECRET: "replace-with-a-long-random-secret",
  BETTER_AUTH_URL: "https://app.example.com",
});

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

for (const [phase, required] of Object.entries(STAGING_ENVIRONMENT_PHASES)) {
  assert.ok(required.length > 0, `${phase} inventory must have at least one required variable`);
}

console.log("STAGING_ENVIRONMENT_INVENTORY_TEST_PASS");
