import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  assertIsolatedCiMigrationHistory,
  requireCommercePostgresIntegrationTarget,
} from "./commerce-postgres-integration-target";

const repositoryRoot = process.cwd();
const migrationHistory = await import("@/scripts/migration-history-guard").then((module) =>
  module.inspectMigrationHistory(),
);
const safeEnv = {
  CI: "true",
  GITHUB_ACTIONS: "true",
  NODE_ENV: "test",
  IB_COMMERCE_POSTGRES_TEST_TARGET: "github-actions-isolated",
  DATABASE_URL: "postgresql://postgres@127.0.0.1:5432/iburo_commerce?schema=public",
};

const target = await requireCommercePostgresIntegrationTarget("UNUSED", safeEnv);
assert.equal(target.mode, "github-actions-isolated");
assert.equal(target.expectedDatabaseName, "iburo_commerce");
assert.equal(target.expectedUser, "postgres");

for (const unsafeUrl of [
  "postgresql://postgres@localhost:5432/iburo_commerce?schema=public",
  "postgresql://postgres@127.0.0.1:5433/iburo_commerce?schema=public",
  "postgresql://postgres@127.0.0.1:5432/production?schema=public",
  "postgresql://other@127.0.0.1:5432/iburo_commerce?schema=public",
  ["postgresql://postgres", ":credential", "@127.0.0.1:5432/iburo_commerce?schema=public"].join(""),
]) {
  await assert.rejects(
    requireCommercePostgresIntegrationTarget("UNUSED", { ...safeEnv, DATABASE_URL: unsafeUrl }),
    /does not match the isolated GitHub Actions PostgreSQL service/,
  );
}

await assert.rejects(
  requireCommercePostgresIntegrationTarget("UNUSED", { ...safeEnv, GITHUB_ACTIONS: "false" }),
  /restricted to GitHub Actions/,
);

const applied = migrationHistory.migrations.map((migration) => ({
  migrationName: migration.name,
  finishedAt: new Date(),
  rolledBackAt: null,
}));
assert.doesNotThrow(() => assertIsolatedCiMigrationHistory(migrationHistory, applied));
assert.throws(
  () => assertIsolatedCiMigrationHistory(migrationHistory, applied.slice(1)),
  /do not match the repository history/,
);
assert.throws(
  () =>
    assertIsolatedCiMigrationHistory(migrationHistory, [
      ...applied,
      { migrationName: "unfinished", finishedAt: null, rolledBackAt: null },
    ]),
  /unfinished migrations/,
);

const workflow = await readFile(`${repositoryRoot}/.github/workflows/commerce-postgres-integration.yml`, "utf8");
assert.match(workflow, /IB_COMMERCE_POSTGRES_TEST_TARGET:\s*github-actions-isolated/);
assert.match(workflow, /commerce-postgres-checkout-recovery\.integration\.ts/);

console.log("COMMERCE_POSTGRES_INTEGRATION_TARGET_PASS");
