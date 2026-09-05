import { NextResponse } from "next/server";
import { Pool } from "pg";
import {
  REQUIRED_STAGING_DOMAIN_TABLES,
  REQUIRED_STAGING_ENUMS,
  REQUIRED_STORED_FILE_SCAN_COLUMNS,
  REQUIRED_STORED_FILE_STATUS_VALUES,
  assertStagingSchemaContract,
} from "@/scripts/staging-schema-contract";
import { requireStagingDatabaseTarget } from "@/scripts/staging-target-guard";
import {
  VERCEL_STAGING_BRANCH,
  isVercelPreviewBackendAllowed,
} from "@/server/config/vercel-preview-boundary";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex",
};

const EXPECTED_PRISMA_MIGRATION = "20260831_initial_baseline";
const BETTER_AUTH_TABLES = [
  "user",
  "session",
  "account",
  "verification",
  "twoFactor",
  "rateLimit",
] as const;
const EXACT_GIT_SHA_PATTERN = /^[a-f0-9]{40}$/i;

type MigrationRow = {
  migration_name: string;
  finished_at: Date | null;
  rolled_back_at: Date | null;
};

type ProbeFailureStage =
  | "target"
  | "connect"
  | "begin"
  | "identity"
  | "catalog"
  | "domain-contract"
  | "prisma-history"
  | "rollback";

function exactPreviewCommitSha(env: NodeJS.ProcessEnv): string | null {
  const value = env.VERCEL_GIT_COMMIT_SHA?.trim();
  return value && EXACT_GIT_SHA_PATTERN.test(value) ? value.toLowerCase() : null;
}

function isExactStagingPreview(env: NodeJS.ProcessEnv): boolean {
  return (
    env.VERCEL_ENV?.trim() === "preview" &&
    env.VERCEL_GIT_COMMIT_REF?.trim() === VERCEL_STAGING_BRANCH &&
    env.IB_RUNTIME_TARGET?.trim() === "staging" &&
    exactPreviewCommitSha(env) !== null &&
    isVercelPreviewBackendAllowed(env)
  );
}

function unavailable(status = 404, failureStage?: ProbeFailureStage) {
  return NextResponse.json(
    {
      service: "iburo127",
      probe: "staging-db-baseline",
      available: false,
      ...(failureStage ? { failureStage } : {}),
    },
    { status, headers: NO_STORE_HEADERS },
  );
}

export async function GET() {
  const env = process.env;
  if (!isExactStagingPreview(env)) return unavailable();

  let target: ReturnType<typeof requireStagingDatabaseTarget>;
  try {
    target = requireStagingDatabaseTarget(env);
  } catch {
    return unavailable(503, "target");
  }

  const pool = new Pool({
    connectionString: target.databaseUrl,
    connectionTimeoutMillis: 10_000,
    statement_timeout: 10_000,
    max: 1,
  });

  try {
    const client = await pool.connect();
    let transactionOpen = false;
    let failureStage: ProbeFailureStage = "begin";
    try {
      await client.query("BEGIN READ ONLY");
      transactionOpen = true;

      failureStage = "identity";
      const identity = await client.query<{ database_name: string; current_schema: string | null }>(
        "select current_database() as database_name, current_schema() as current_schema",
      );
      const identityRow = identity.rows[0];
      if (!identityRow || identityRow.database_name !== target.expectedDatabaseName) {
        throw new Error("staging database identity mismatch");
      }
      if (identityRow.current_schema !== "public") {
        throw new Error("staging schema identity mismatch");
      }

      failureStage = "catalog";
      const tableResult = await client.query<{ table_name: string }>(
        `
          select table_name
          from information_schema.tables
          where table_schema = 'public'
            and table_type = 'BASE TABLE'
          order by table_name
        `,
      );
      const tableNames = tableResult.rows.map((row) => row.table_name);
      const tableSet = new Set(tableNames);

      const enumResult = await client.query<{ enum_name: string }>(
        `
          select t.typname as enum_name
          from pg_type t
          join pg_namespace n on n.oid = t.typnamespace
          where n.nspname = 'public'
            and t.typtype = 'e'
          order by t.typname
        `,
      );
      const enumNames = enumResult.rows.map((row) => row.enum_name);

      const storedFileColumnResult = await client.query<{ column_name: string }>(
        `
          select column_name
          from information_schema.columns
          where table_schema = 'public'
            and table_name = 'StoredFile'
          order by ordinal_position
        `,
      );
      const storedFileColumns = storedFileColumnResult.rows.map((row) => row.column_name);

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
      const storedFileStatusValues = storedFileStatusResult.rows.map((row) => row.enum_value);

      const prismaMigrationTablePresent = tableSet.has("_prisma_migrations");
      let migrationRows: MigrationRow[] = [];
      if (prismaMigrationTablePresent) {
        failureStage = "prisma-history";
        const migrationResult = await client.query<MigrationRow>(
          `
            select migration_name, finished_at, rolled_back_at
            from public._prisma_migrations
            order by started_at
          `,
        );
        migrationRows = migrationResult.rows;
      }

      const appliedMigrations = migrationRows.filter(
        (row) => row.finished_at !== null && row.rolled_back_at === null,
      );
      const unfinishedMigrations = migrationRows.filter(
        (row) => row.finished_at === null && row.rolled_back_at === null,
      );

      failureStage = "domain-contract";
      assertStagingSchemaContract({
        tables: tableNames,
        enums: enumNames,
        storedFile: {
          columns: storedFileColumns,
          statusValues: storedFileStatusValues,
        },
        prismaMigrationHistory: {
          tablePresent: prismaMigrationTablePresent,
          appliedCount: appliedMigrations.length,
          unfinishedCount: unfinishedMigrations.length,
        },
      });

      failureStage = "prisma-history";
      if (
        appliedMigrations.length !== 1 ||
        unfinishedMigrations.length !== 0 ||
        appliedMigrations[0]?.migration_name !== EXPECTED_PRISMA_MIGRATION
      ) {
        throw new Error("staging Prisma migration history does not match the reviewed baseline");
      }

      const presentDomainTables = REQUIRED_STAGING_DOMAIN_TABLES.filter((name) => tableSet.has(name));
      const enumSet = new Set(enumNames);
      const presentDomainEnums = REQUIRED_STAGING_ENUMS.filter((name) => enumSet.has(name));
      const storedFileColumnSet = new Set(storedFileColumns);
      const storedFileStatusSet = new Set(storedFileStatusValues);
      const presentBetterAuthTables = BETTER_AUTH_TABLES.filter((name) => tableSet.has(name));
      const betterAuthState =
        presentBetterAuthTables.length === 0
          ? "clean"
          : presentBetterAuthTables.length === BETTER_AUTH_TABLES.length
            ? "complete"
            : "partial";

      failureStage = "rollback";
      await client.query("ROLLBACK");
      transactionOpen = false;

      return NextResponse.json(
        {
          service: "iburo127",
          probe: "staging-db-baseline",
          environment: "preview",
          branch: VERCEL_STAGING_BRANCH,
          commitSha: exactPreviewCommitSha(env),
          runtimeTarget: "staging",
          readOnly: true,
          database: {
            name: identityRow.database_name,
            schema: identityRow.current_schema,
          },
          domain: {
            tables: {
              present: presentDomainTables.length,
              expected: REQUIRED_STAGING_DOMAIN_TABLES.length,
              pass: presentDomainTables.length === REQUIRED_STAGING_DOMAIN_TABLES.length,
            },
            enums: {
              present: presentDomainEnums.length,
              expected: REQUIRED_STAGING_ENUMS.length,
              pass: presentDomainEnums.length === REQUIRED_STAGING_ENUMS.length,
            },
            storedFile: {
              scanColumnsPass: REQUIRED_STORED_FILE_SCAN_COLUMNS.every((name) =>
                storedFileColumnSet.has(name),
              ),
              statusValuesPass: REQUIRED_STORED_FILE_STATUS_VALUES.every((name) =>
                storedFileStatusSet.has(name),
              ),
            },
          },
          prisma: {
            migrationTablePresent: prismaMigrationTablePresent,
            appliedCount: appliedMigrations.length,
            unfinishedCount: unfinishedMigrations.length,
            appliedMigration: appliedMigrations[0]?.migration_name ?? null,
            pass: true,
          },
          betterAuth: {
            present: presentBetterAuthTables.length,
            expected: BETTER_AUTH_TABLES.length,
            state: betterAuthState,
          },
          pass: true,
        },
        { headers: NO_STORE_HEADERS },
      );
    } catch {
      if (transactionOpen) {
        try {
          await client.query("ROLLBACK");
        } catch {
          // Preserve the original verification stage without exposing exception details.
        }
      }
      return unavailable(503, failureStage);
    } finally {
      client.release();
    }
  } catch {
    return unavailable(503, "connect");
  } finally {
    await pool.end();
  }
}
