import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  assertPinnedMigrationHistory,
  inspectMigrationHistory,
  MigrationHistoryError,
} from "../scripts/migration-history-guard";

async function expectMigrationError(operation: () => Promise<unknown>, contains: string) {
  await assert.rejects(operation, (error: unknown) => {
    assert.ok(error instanceof MigrationHistoryError);
    assert.match(error.message, new RegExp(contains));
    return true;
  });
}

const root = await mkdtemp(join(tmpdir(), "iburo-migration-history-"));
try {
  const missing = join(root, "missing");
  await expectMigrationError(
    () => inspectMigrationHistory(missing),
    "authoritative database baseline is unresolved",
  );

  const migrationsDir = join(root, "migrations");
  await mkdir(migrationsDir, { recursive: true });
  await writeFile(join(migrationsDir, "migration_lock.toml"), 'provider = "postgresql"\n', "utf8");
  const migrationDir = join(migrationsDir, "202608280001_initial");
  await mkdir(migrationDir);
  await writeFile(
    join(migrationDir, "migration.sql"),
    'CREATE TABLE "Example" ("id" TEXT PRIMARY KEY);\n',
    "utf8",
  );

  const first = await inspectMigrationHistory(migrationsDir);
  const second = await inspectMigrationHistory(migrationsDir);
  assert.equal(first.provider, "postgresql");
  assert.equal(first.migrationCount, 1);
  assert.equal(first.fingerprint, second.fingerprint);
  assert.match(first.fingerprint, /^[a-f0-9]{64}$/);
  assert.equal(first.migrations[0]?.name, "202608280001_initial");

  assertPinnedMigrationHistory(first, first.fingerprint);
  assert.throws(
    () => assertPinnedMigrationHistory(first, undefined),
    /missing IB_STAGING_MIGRATION_HISTORY_SHA256/,
  );
  assert.throws(
    () => assertPinnedMigrationHistory(first, "0".repeat(64)),
    /does not match the reviewed staging fingerprint/,
  );

  const emptyDir = join(root, "empty-migration");
  await mkdir(emptyDir);
  await writeFile(join(emptyDir, "migration_lock.toml"), 'provider = "postgresql"\n', "utf8");
  await mkdir(join(emptyDir, "202608280002_empty"));
  await writeFile(join(emptyDir, "202608280002_empty", "migration.sql"), "\n", "utf8");
  await expectMigrationError(
    () => inspectMigrationHistory(emptyDir),
    "migration SQL is empty",
  );

  const wrongProvider = join(root, "wrong-provider");
  await mkdir(wrongProvider);
  await writeFile(join(wrongProvider, "migration_lock.toml"), 'provider = "sqlite"\n', "utf8");
  await mkdir(join(wrongProvider, "202608280003_wrong"));
  await writeFile(join(wrongProvider, "202608280003_wrong", "migration.sql"), "SELECT 1;\n", "utf8");
  await expectMigrationError(
    () => inspectMigrationHistory(wrongProvider),
    'provider = "postgresql"',
  );

  console.log("MIGRATION_HISTORY_GUARD_TEST_PASS");
} finally {
  await rm(root, { recursive: true, force: true });
}
