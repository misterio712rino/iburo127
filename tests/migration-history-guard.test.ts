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

async function createValidHistory(
  root: string,
  name: string,
  migrations: Array<{ name: string; sql: string }>,
): Promise<string> {
  const migrationsDir = join(root, name);
  await mkdir(migrationsDir, { recursive: true });
  await writeFile(
    join(migrationsDir, "migration_lock.toml"),
    '# Prisma migration lock\nprovider = "postgresql"\n',
    "utf8",
  );

  for (const migration of migrations) {
    const migrationDir = join(migrationsDir, migration.name);
    await mkdir(migrationDir);
    await writeFile(join(migrationDir, "migration.sql"), migration.sql, "utf8");
  }

  return migrationsDir;
}

const root = await mkdtemp(join(tmpdir(), "iburo-migration-history-"));
try {
  const missing = join(root, "missing");
  await expectMigrationError(
    () => inspectMigrationHistory(missing),
    "authoritative database baseline is unresolved",
  );

  const noMigrations = join(root, "no-migrations");
  await mkdir(noMigrations);
  await writeFile(
    join(noMigrations, "migration_lock.toml"),
    'provider = "postgresql"\n',
    "utf8",
  );
  await expectMigrationError(
    () => inspectMigrationHistory(noMigrations),
    "no reviewed Prisma migration history exists",
  );

  const migrationsDir = await createValidHistory(root, "valid", [
    {
      name: "202608280001_initial",
      sql: 'CREATE TABLE "Example" ("id" TEXT PRIMARY KEY);\n',
    },
  ]);

  const reviewed = await inspectMigrationHistory(migrationsDir);
  assert.equal(reviewed.provider, "postgresql");
  assert.equal(reviewed.migrationCount, 1);
  assert.match(reviewed.fingerprint, /^[a-f0-9]{64}$/);
  assert.equal(reviewed.migrations[0]?.name, "202608280001_initial");
  assertPinnedMigrationHistory(reviewed, reviewed.fingerprint);
  assert.throws(
    () => assertPinnedMigrationHistory(reviewed, undefined),
    /missing IB_STAGING_MIGRATION_HISTORY_SHA256/,
  );
  assert.throws(
    () => assertPinnedMigrationHistory(reviewed, "0".repeat(64)),
    /does not match the reviewed staging fingerprint/,
  );

  const emptySql = await createValidHistory(root, "empty-sql", [
    { name: "202608280002_empty", sql: "\n" },
  ]);
  await expectMigrationError(
    () => inspectMigrationHistory(emptySql),
    "migration SQL is empty",
  );

  const missingSql = join(root, "missing-sql");
  await mkdir(join(missingSql, "202608280003_missing"), { recursive: true });
  await writeFile(
    join(missingSql, "migration_lock.toml"),
    'provider = "postgresql"\n',
    "utf8",
  );
  await expectMigrationError(
    () => inspectMigrationHistory(missingSql),
    "missing migration SQL",
  );

  const wrongProvider = await createValidHistory(root, "wrong-provider", [
    { name: "202608280004_wrong", sql: "SELECT 1;\n" },
  ]);
  await writeFile(
    join(wrongProvider, "migration_lock.toml"),
    'provider = "sqlite"\n',
    "utf8",
  );
  await expectMigrationError(
    () => inspectMigrationHistory(wrongProvider),
    'provider = "postgresql"',
  );

  const malformedLock = await createValidHistory(root, "malformed-lock", [
    { name: "202608280005_lock", sql: "SELECT 1;\n" },
  ]);
  await writeFile(
    join(malformedLock, "migration_lock.toml"),
    'provider = "postgresql"\nunexpected = "value"\n',
    "utf8",
  );
  await expectMigrationError(
    () => inspectMigrationHistory(malformedLock),
    "must contain only provider",
  );

  const unexpectedRoot = await createValidHistory(root, "unexpected-root", [
    { name: "202608280006_root", sql: "SELECT 1;\n" },
  ]);
  await writeFile(join(unexpectedRoot, "README.md"), "unexpected\n", "utf8");
  await expectMigrationError(
    () => inspectMigrationHistory(unexpectedRoot),
    "unexpected entry in prisma/migrations: README.md",
  );

  const unexpectedMigrationFile = await createValidHistory(
    root,
    "unexpected-migration-file",
    [{ name: "202608280007_extra", sql: "SELECT 1;\n" }],
  );
  await writeFile(
    join(unexpectedMigrationFile, "202608280007_extra", "notes.txt"),
    "unexpected\n",
    "utf8",
  );
  await expectMigrationError(
    () => inspectMigrationHistory(unexpectedMigrationFile),
    "unexpected entry in migration 202608280007_extra: notes.txt",
  );

  const modifiedSql = await createValidHistory(root, "modified-sql", [
    { name: "202608280008_modified", sql: "SELECT 1;\n" },
  ]);
  const beforeModification = await inspectMigrationHistory(modifiedSql);
  await writeFile(
    join(modifiedSql, "202608280008_modified", "migration.sql"),
    "SELECT 2;\n",
    "utf8",
  );
  const afterModification = await inspectMigrationHistory(modifiedSql);
  assert.notEqual(afterModification.fingerprint, beforeModification.fingerprint);
  assert.throws(
    () => assertPinnedMigrationHistory(afterModification, beforeModification.fingerprint),
    /does not match the reviewed staging fingerprint/,
  );

  const addedMigration = await createValidHistory(root, "added-migration", [
    { name: "202608280009_first", sql: "SELECT 1;\n" },
  ]);
  const beforeAddition = await inspectMigrationHistory(addedMigration);
  const secondMigrationDir = join(addedMigration, "202608280010_second");
  await mkdir(secondMigrationDir);
  await writeFile(join(secondMigrationDir, "migration.sql"), "SELECT 2;\n", "utf8");
  const afterAddition = await inspectMigrationHistory(addedMigration);
  assert.equal(afterAddition.migrationCount, 2);
  assert.notEqual(afterAddition.fingerprint, beforeAddition.fingerprint);
  assert.throws(
    () => assertPinnedMigrationHistory(afterAddition, beforeAddition.fingerprint),
    /does not match the reviewed staging fingerprint/,
  );

  const orderA = await createValidHistory(root, "order-a", [
    { name: "202608280012_second", sql: "SELECT 2;\n" },
    { name: "202608280011_first", sql: "SELECT 1;\n" },
  ]);
  const orderB = await createValidHistory(root, "order-b", [
    { name: "202608280011_first", sql: "SELECT 1;\n" },
    { name: "202608280012_second", sql: "SELECT 2;\n" },
  ]);
  const orderedA = await inspectMigrationHistory(orderA);
  const orderedB = await inspectMigrationHistory(orderB);
  assert.deepEqual(
    orderedA.migrations.map((migration) => migration.name),
    ["202608280011_first", "202608280012_second"],
  );
  assert.deepEqual(
    orderedB.migrations.map((migration) => migration.name),
    ["202608280011_first", "202608280012_second"],
  );
  assert.equal(orderedA.fingerprint, orderedB.fingerprint);

  console.log("MIGRATION_HISTORY_GUARD_TEST_PASS");
} finally {
  await rm(root, { recursive: true, force: true });
}
