import "dotenv/config";

import { Pool } from "pg";
import {
  assertStagingSchemaContract,
  REQUIRED_STAGING_DOMAIN_TABLES,
  REQUIRED_STAGING_ENUMS,
} from "./staging-schema-contract";
import { requireStagingDatabaseTarget } from "./staging-target-guard";

function fail(message: string): never {
  console.error(`STAGING_SCHEMA_VERIFY_FAIL: ${message}`);
  process.exit(1);
}

function parseCount(value: string | undefined, label: string): number {
  const parsed = Number(value ?? "NaN");
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    fail(`could not evaluate ${label}`);
  }
  return parsed;
}

let target: ReturnType<typeof requireStagingDatabaseTarget>;
try {
  target = requireStagingDatabaseTarget();
} catch (error) {
  fail(error instanceof Error ? error.message : "invalid staging database target");
}

const pool = new Pool({
  connectionString: target.databaseUrl,
  connectionTimeoutMillis: 10_000,
  statement_timeout: 10_000,
  max: 1,
});

const client = await pool.connect();
try {
  await client.query("BEGIN READ ONLY");

  const identity = await client.query<{ database_name: string }>(
    "select current_database() as database_name",
  );
  const databaseName = identity.rows[0]?.database_name;
  if (!databaseName) fail("database identity query returned no rows");
  if (databaseName !== target.expectedDatabaseName) {
    fail(
      `connected database ${databaseName} does not match IB_STAGING_DATABASE_NAME ${target.expectedDatabaseName}`,
    );
  }

  const tableResult = await client.query<{ table_name: string }>(
    `
      select table_name
      from information_schema.tables
      where table_schema = 'public'
        and table_type = 'BASE TABLE'
    `,
  );
  const existingTables = new Set(tableResult.rows.map((row) => row.table_name));

  const enumResult = await client.query<{ type_name: string }>(
    `
      select t.typname as type_name
      from pg_type t
      join pg_namespace n on n.oid = t.typnamespace
      where n.nspname = 'public'
        and t.typtype = 'e'
    `,
  );
  const existingEnums = new Set(enumResult.rows.map((row) => row.type_name));

  const prismaMigrationsTablePresent = existingTables.has("_prisma_migrations");
  let appliedMigrationCount = 0;
  let unfinishedMigrationCount = 0;

  if (prismaMigrationsTablePresent) {
    const migrationResult = await client.query<{
      applied_count: string;
      unfinished_count: string;
    }>(
      `
        select
          count(*) filter (
            where finished_at is not null
              and rolled_back_at is null
          )::text as applied_count,
          count(*) filter (
            where finished_at is null
              and rolled_back_at is null
          )::text as unfinished_count
        from "_prisma_migrations"
      `,
    );
    appliedMigrationCount = parseCount(
      migrationResult.rows[0]?.applied_count,
      "Prisma applied migration count",
    );
    unfinishedMigrationCount = parseCount(
      migrationResult.rows[0]?.unfinished_count,
      "Prisma unfinished migration count",
    );
  }

  try {
    assertStagingSchemaContract({
      tables: existingTables,
      enums: existingEnums,
      prismaMigrationHistory: {
        tablePresent: prismaMigrationsTablePresent,
        appliedCount: appliedMigrationCount,
        unfinishedCount: unfinishedMigrationCount,
      },
    });
  } catch (error) {
    fail(error instanceof Error ? error.message : "staging schema contract failed");
  }

  console.log(`Staging database identity verified: ${databaseName}`);
  console.log(
    `Required domain tables verified: ${REQUIRED_STAGING_DOMAIN_TABLES.length}`,
  );
  console.log(`Required PostgreSQL enums verified: ${REQUIRED_STAGING_ENUMS.length}`);
  console.log(`Applied Prisma migrations verified: ${appliedMigrationCount}`);
  console.log("STAGING_SCHEMA_VERIFY_PASS");

  await client.query("ROLLBACK");
} catch (error) {
  try {
    await client.query("ROLLBACK");
  } catch {
    // Preserve the original failure.
  }
  throw error;
} finally {
  client.release();
  await pool.end();
}
