import "dotenv/config";

import { Pool } from "pg";
import {
  classifyStagingBaseline,
  REQUIRED_BETTER_AUTH_TABLES,
} from "./staging-baseline-classifier";
import {
  REQUIRED_STAGING_DOMAIN_TABLES,
  REQUIRED_STAGING_ENUMS,
} from "./staging-schema-contract";
import { requireStagingDatabaseTarget } from "./staging-target-guard";

function fail(message: string): never {
  console.error(`DATABASE_BASELINE_SUMMARY_FAIL: ${message}`);
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

const betterAuthSchema = process.env.IB_STAGING_BETTER_AUTH_SCHEMA?.trim();
if (!betterAuthSchema) {
  fail("missing IB_STAGING_BETTER_AUTH_SCHEMA");
}

const pool = new Pool({
  connectionString: target.databaseUrl,
  connectionTimeoutMillis: 10_000,
  statement_timeout: 10_000,
  max: 1,
});

try {
  const client = await pool.connect();
  try {
    await client.query("BEGIN READ ONLY");

    const identityResult = await client.query<{
      database_name: string;
      database_user: string;
    }>("select current_database() as database_name, current_user as database_user");
    const identity = identityResult.rows[0];
    if (!identity) fail("database identity query returned no rows");
    if (identity.database_name !== target.expectedDatabaseName) {
      fail("connected database does not match the guarded staging database name");
    }
    if (identity.database_user !== target.expectedUser) {
      fail("connected database user does not match the guarded staging database user");
    }

    const totalTableResult = await client.query<{ count: string }>(`
      select count(*)::text as count
      from information_schema.tables
      where table_type = 'BASE TABLE'
        and table_schema not in ('pg_catalog', 'information_schema')
        and table_schema not like 'pg_toast%'
        and table_schema not like 'pg_temp_%'
    `);
    const totalUserTableCount = parseCount(
      totalTableResult.rows[0]?.count,
      "total user table count",
    );

    const domainTableResult = await client.query<{ count: string }>(
      `
        select count(*)::text as count
        from information_schema.tables
        where table_schema = 'public'
          and table_type = 'BASE TABLE'
          and table_name = any($1::text[])
      `,
      [[...REQUIRED_STAGING_DOMAIN_TABLES]],
    );
    const domainTableCount = parseCount(
      domainTableResult.rows[0]?.count,
      "required domain table count",
    );

    const domainEnumResult = await client.query<{ count: string }>(
      `
        select count(*)::text as count
        from pg_type type
        join pg_namespace namespace on namespace.oid = type.typnamespace
        where namespace.nspname = 'public'
          and type.typtype = 'e'
          and type.typname = any($1::text[])
      `,
      [[...REQUIRED_STAGING_ENUMS]],
    );
    const domainEnumCount = parseCount(
      domainEnumResult.rows[0]?.count,
      "required domain enum count",
    );

    const betterAuthTableResult = await client.query<{ count: string }>(
      `
        select count(*)::text as count
        from information_schema.tables
        where table_schema = $1
          and table_type = 'BASE TABLE'
          and table_name = any($2::text[])
      `,
      [betterAuthSchema, [...REQUIRED_BETTER_AUTH_TABLES]],
    );
    const betterAuthTableCount = parseCount(
      betterAuthTableResult.rows[0]?.count,
      "Better Auth table count",
    );

    const prismaTableResult = await client.query<{ exists: boolean }>(`
      select exists (
        select 1
        from information_schema.tables
        where table_schema = 'public'
          and table_type = 'BASE TABLE'
          and table_name = '_prisma_migrations'
      ) as exists
    `);
    const prismaTablePresent = prismaTableResult.rows[0]?.exists ?? false;

    let appliedMigrationCount = 0;
    let unfinishedMigrationCount = 0;
    if (prismaTablePresent) {
      const migrationResult = await client.query<{
        applied_count: string;
        unfinished_count: string;
      }>(`
        select
          count(*) filter (
            where finished_at is not null
              and rolled_back_at is null
          )::text as applied_count,
          count(*) filter (
            where finished_at is null
              and rolled_back_at is null
          )::text as unfinished_count
        from public."_prisma_migrations"
      `);
      appliedMigrationCount = parseCount(
        migrationResult.rows[0]?.applied_count,
        "Prisma applied migration count",
      );
      unfinishedMigrationCount = parseCount(
        migrationResult.rows[0]?.unfinished_count,
        "Prisma unfinished migration count",
      );
    }

    const classification = classifyStagingBaseline({
      totalUserTableCount,
      domainTableCount,
      domainEnumCount,
      betterAuthTableCount,
      prismaMigrationHistory: {
        tablePresent: prismaTablePresent,
        appliedCount: appliedMigrationCount,
        unfinishedCount: unfinishedMigrationCount,
      },
    });

    const summary = {
      inspectedAt: new Date().toISOString(),
      targetVerified: true,
      totalUserTableCount,
      domain: {
        presentTableCount: domainTableCount,
        requiredTableCount: REQUIRED_STAGING_DOMAIN_TABLES.length,
        presentEnumCount: domainEnumCount,
        requiredEnumCount: REQUIRED_STAGING_ENUMS.length,
      },
      betterAuth: {
        presentTableCount: betterAuthTableCount,
        requiredTableCount: REQUIRED_BETTER_AUTH_TABLES.length,
      },
      prismaMigrations: {
        tablePresent: prismaTablePresent,
        appliedCount: appliedMigrationCount,
        unfinishedCount: unfinishedMigrationCount,
      },
      classification,
    };

    console.log(JSON.stringify(summary, null, 2));
    await client.query("ROLLBACK");
    console.error(`DATABASE_BASELINE_SUMMARY_PASS: strategy=${classification.strategy}`);
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Preserve the original failure.
    }
    throw error;
  } finally {
    client.release();
  }
} finally {
  await pool.end();
}
