import { Pool } from "pg";
import {
  assertStagingSchemaContract,
  REQUIRED_STAGING_DOMAIN_TABLES,
  REQUIRED_STAGING_ENUMS,
  REQUIRED_STORED_FILE_SCAN_COLUMNS,
  REQUIRED_STORED_FILE_STATUS_VALUES,
} from "./staging-schema-contract";
import type { StagingDatabaseTarget } from "./staging-target-guard";

export type StagingSchemaVerificationReport = {
  databaseName: string;
  databaseUser: string;
  requiredTableCount: number;
  requiredEnumCount: number;
  requiredStoredFileScanColumnCount: number;
  requiredStoredFileStatusValueCount: number;
  appliedMigrationCount: number;
};

function parseCount(value: string | undefined, label: string): number {
  const parsed = Number(value ?? "NaN");
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`could not evaluate ${label}`);
  }
  return parsed;
}

export async function verifyStagingDatabaseSchema(
  target: StagingDatabaseTarget,
): Promise<StagingSchemaVerificationReport> {
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

      const identity = await client.query<{
        database_name: string;
        database_user: string;
      }>("select current_database() as database_name, current_user as database_user");
      const databaseIdentity = identity.rows[0];
      if (!databaseIdentity) {
        throw new Error("database identity query returned no rows");
      }
      if (databaseIdentity.database_name !== target.expectedDatabaseName) {
        throw new Error(
          `connected database ${databaseIdentity.database_name} does not match IB_STAGING_DATABASE_NAME ${target.expectedDatabaseName}`,
        );
      }
      if (databaseIdentity.database_user !== target.expectedUser) {
        throw new Error(
          `connected database user ${databaseIdentity.database_user} does not match IB_STAGING_DATABASE_USER ${target.expectedUser}`,
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

      const storedFileColumnResult = await client.query<{ column_name: string }>(
        `
          select column_name
          from information_schema.columns
          where table_schema = 'public'
            and table_name = 'StoredFile'
        `,
      );
      const storedFileColumns = new Set(
        storedFileColumnResult.rows.map((row) => row.column_name),
      );

      const storedFileStatusResult = await client.query<{ enum_value: string }>(
        `
          select e.enumlabel as enum_value
          from pg_type t
          join pg_namespace n on n.oid = t.typnamespace
          join pg_enum e on e.enumtypid = t.oid
          where n.nspname = 'public'
            and t.typname = 'StoredFileStatus'
          order by e.enumsortorder
        `,
      );
      const storedFileStatusValues = new Set(
        storedFileStatusResult.rows.map((row) => row.enum_value),
      );

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

      assertStagingSchemaContract({
        tables: existingTables,
        enums: existingEnums,
        storedFile: {
          columns: storedFileColumns,
          statusValues: storedFileStatusValues,
        },
        prismaMigrationHistory: {
          tablePresent: prismaMigrationsTablePresent,
          appliedCount: appliedMigrationCount,
          unfinishedCount: unfinishedMigrationCount,
        },
      });

      await client.query("ROLLBACK");
      return {
        databaseName: databaseIdentity.database_name,
        databaseUser: databaseIdentity.database_user,
        requiredTableCount: REQUIRED_STAGING_DOMAIN_TABLES.length,
        requiredEnumCount: REQUIRED_STAGING_ENUMS.length,
        requiredStoredFileScanColumnCount: REQUIRED_STORED_FILE_SCAN_COLUMNS.length,
        requiredStoredFileStatusValueCount: REQUIRED_STORED_FILE_STATUS_VALUES.length,
        appliedMigrationCount,
      };
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
}
