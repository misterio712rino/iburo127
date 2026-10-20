import { NextResponse } from "next/server";
import { Pool } from "pg";
import {
  REQUIRED_STAGING_DOMAIN_TABLES,
  REQUIRED_STAGING_ENUMS,
  REQUIRED_STORED_FILE_SCAN_COLUMNS,
  REQUIRED_STORED_FILE_STATUS_VALUES,
  assertDocumentRevisionSchemaContract,
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

const EXPECTED_PRISMA_MIGRATIONS = [
  "20260831_initial_baseline",
  "20260901_access_gate_leads",
  "20260905_practicum_homework_lesson_chat",
  "20260906_stored_file_deletion_foundation",
  "20260917_case_document_revisions",
  "20260927_commerce_foundation",
  "20260927_commerce_order_checkout_idempotency",
  "20261007_commerce_stripe_checkout",
  "20261008_commerce_checkout_session_recovery",
  "20261008_commerce_checkout_session_recovery_audit",
] as const;
const DOCUMENT_REVISION_MIGRATION_INDEX = 4;
const COMMERCE_FOUNDATION_MIGRATION_INDEX = 5;
const COMMERCE_IDEMPOTENCY_MIGRATION_INDEX = 6;
const COMMERCE_STRIPE_MIGRATION_INDEX = 7;
const COMMERCE_SESSION_RECOVERY_MIGRATION_INDEX = 8;
const COMMERCE_SESSION_RECOVERY_AUDIT_MIGRATION_INDEX = 9;
const COMMERCE_TABLES = ["CommerceOrder", "CommercePayment", "CommercePaymentEvent"] as const;
const COMMERCE_ENUMS = [
  "CommerceOrderStatus",
  "CommercePaymentStatus",
  "CommercePaymentEventKind",
  "CommercePaymentEventProcessingStatus",
] as const;
const BETTER_AUTH_TABLES = [
  "user",
  "session",
  "account",
  "verification",
  "twoFactor",
  "rateLimit",
] as const;
const EXACT_GIT_SHA_PATTERN = /^[a-f0-9]{40}$/i;
const MAX_SCHEMA_CATALOG_BYTES = 128 * 1024;
const MAX_SCHEMA_CATALOG_ROWS = 2_000;

type SchemaCatalog = {
  tables: string[];
  columns: Array<{
    table: string;
    name: string;
    type: string;
    nullable: boolean;
    maxLength: number | null;
    numericPrecision: number | null;
    numericScale: number | null;
  }>;
  constraints: Array<{ table: string; name: string; type: string; definition: string }>;
  indexes: Array<{ table: string; name: string; definition: string }>;
  enums: Array<{ name: string; values: string[] }>;
};

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

// Accept only an exact prefix of the reviewed migration history. This lets the
// read-only probe report an older staging schema safely while rejecting unknown,
// duplicated, reordered or partially tracked migration history.
function reviewedMigrationState(appliedMigrations: readonly MigrationRow[]) {
  if (appliedMigrations.length > EXPECTED_PRISMA_MIGRATIONS.length) return null;
  const appliedNames = appliedMigrations.map((row) => row.migration_name);
  if (new Set(appliedNames).size !== appliedNames.length) return null;
  for (let index = 0; index < appliedNames.length; index += 1) {
    if (appliedNames[index] !== EXPECTED_PRISMA_MIGRATIONS[index]) return null;
  }

  const appliedCount = appliedNames.length;
  const documentRevisionApplied = appliedCount > DOCUMENT_REVISION_MIGRATION_INDEX;
  const commerceFoundationApplied = appliedCount > COMMERCE_FOUNDATION_MIGRATION_INDEX;
  const commerceIdempotencyApplied = appliedCount > COMMERCE_IDEMPOTENCY_MIGRATION_INDEX;
  const commerceStripeApplied = appliedCount > COMMERCE_STRIPE_MIGRATION_INDEX;
  const commerceSessionRecoveryApplied = appliedCount > COMMERCE_SESSION_RECOVERY_MIGRATION_INDEX;
  const commerceSessionRecoveryAuditApplied = appliedCount > COMMERCE_SESSION_RECOVERY_AUDIT_MIGRATION_INDEX;

  return {
    appliedCount,
    pendingCount: EXPECTED_PRISMA_MIGRATIONS.length - appliedCount,
    documentRevisionApplied,
    commerceFoundationApplied,
    commerceIdempotencyApplied,
    commerceStripeApplied,
    commerceSessionRecoveryApplied,
    commerceSessionRecoveryAuditApplied,
    commerceReady: commerceFoundationApplied && commerceIdempotencyApplied && commerceStripeApplied && commerceSessionRecoveryApplied,
    commerceRecoveryReady: commerceFoundationApplied && commerceIdempotencyApplied && commerceStripeApplied && commerceSessionRecoveryApplied && commerceSessionRecoveryAuditApplied,
  };
}

export async function GET(request: Request) {
  const env = process.env;
  if (!isExactStagingPreview(env)) return unavailable();
  const query = new URL(request.url).searchParams;
  const includeSchemaCatalog = query.get("schema") === "1";
  if (query.has("schema") && !includeSchemaCatalog) return unavailable(400);

  let target: ReturnType<typeof requireStagingDatabaseTarget>;
  try {
    target = requireStagingDatabaseTarget(env);
  } catch {
    return unavailable(503, "target");
  }

  let databaseProvider: "neon" | "yandex" | "other" = "other";
  try {
    const hostname = new URL(target.databaseUrl).hostname.toLowerCase();
    if (hostname.endsWith(".neon.tech")) databaseProvider = "neon";
    else if (hostname.endsWith(".yandexcloud.net")) databaseProvider = "yandex";
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
      const identity = await client.query<{
        database_name: string;
        database_user: string;
        current_schema: string | null;
      }>(
        "select current_database() as database_name, current_user as database_user, current_schema() as current_schema",
      );
      const identityRow = identity.rows[0];
      if (!identityRow || identityRow.database_name !== target.expectedDatabaseName) {
        throw new Error("staging database identity mismatch");
      }
      if (identityRow.database_user !== target.expectedUser) {
        throw new Error("staging database user identity mismatch");
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

      const commerceOrderColumnResult = await client.query<{ column_name: string }>(
        `
          select column_name
          from information_schema.columns
          where table_schema = 'public'
            and table_name = 'CommerceOrder'
          order by ordinal_position
        `,
      );
      const commerceOrderColumns = commerceOrderColumnResult.rows.map((row) => row.column_name);

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
      const migrationState = reviewedMigrationState(appliedMigrations);
      if (unfinishedMigrations.length !== 0 || migrationState === null) {
        throw new Error("staging Prisma migration history does not match the reviewed migration prefix");
      }

      const revisionTablePresent = tableSet.has("CaseDocumentRevision");
      const revisionEnumPresent = enumNames.includes("CaseDocumentRevisionStatus");
      if (migrationState.documentRevisionApplied) {
        assertDocumentRevisionSchemaContract({ tables: tableNames, enums: enumNames });
      } else if (revisionTablePresent || revisionEnumPresent) {
        throw new Error("untracked document revision schema drift");
      }

      const commerceTablesPresent = COMMERCE_TABLES.filter((name) => tableSet.has(name));
      const commerceEnumsPresent = COMMERCE_ENUMS.filter((name) => enumNames.includes(name));
      const commerceCheckoutRequestIdPresent = commerceOrderColumns.includes("checkoutRequestId");
      const commerceStripeSessionIdPresent = commerceOrderColumns.includes("stripeCheckoutSessionId");
      const commercePreviousPlanIdPresent = commerceOrderColumns.includes("previousPlanId");
      const commerceRecoveryAttemptMarkerPresent = commerceOrderColumns.includes("stripeCheckoutSessionCreateStartedAt");
      const commerceRecoveryAuditTablePresent = tableSet.has("CommerceCheckoutSessionRecovery");

      if (migrationState.commerceFoundationApplied) {
        if (
          commerceTablesPresent.length !== COMMERCE_TABLES.length ||
          commerceEnumsPresent.length !== COMMERCE_ENUMS.length
        ) {
          throw new Error("commerce foundation migration recorded without required schema objects");
        }
      } else if (commerceTablesPresent.length > 0 || commerceEnumsPresent.length > 0) {
        throw new Error("untracked commerce foundation schema drift");
      }

      if (migrationState.commerceIdempotencyApplied) {
        if (!commerceCheckoutRequestIdPresent) {
          throw new Error("commerce idempotency migration recorded without checkoutRequestId");
        }
      } else if (commerceCheckoutRequestIdPresent) {
        throw new Error("untracked commerce idempotency schema drift");
      }

      if (migrationState.commerceStripeApplied) {
        if (!commerceStripeSessionIdPresent || !commercePreviousPlanIdPresent) {
          throw new Error("Stripe commerce migration recorded without required CommerceOrder columns");
        }
      } else if (commerceStripeSessionIdPresent || commercePreviousPlanIdPresent) {
        throw new Error("untracked Stripe commerce schema drift");
      }

      if (migrationState.commerceSessionRecoveryApplied) {
        if (!commerceRecoveryAttemptMarkerPresent) {
          throw new Error("checkout session recovery migration recorded without attempt marker");
        }
      } else if (commerceRecoveryAttemptMarkerPresent) {
        throw new Error("untracked checkout session recovery schema drift");
      }

      if (migrationState.commerceSessionRecoveryAuditApplied) {
        if (!commerceRecoveryAuditTablePresent) {
          throw new Error("checkout session recovery audit migration recorded without audit table");
        }
      } else if (commerceRecoveryAuditTablePresent) {
        throw new Error("untracked checkout session recovery audit schema drift");
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

      let schemaCatalog: SchemaCatalog | undefined;
      if (includeSchemaCatalog) {
        failureStage = "catalog";
        const [columnResult, constraintResult, indexResult, enumValueResult] = await Promise.all([
          client.query<{
            table_name: string;
            column_name: string;
            udt_name: string;
            is_nullable: string;
            character_maximum_length: number | null;
            numeric_precision: number | null;
            numeric_scale: number | null;
          }>(`
            select table_name, column_name, udt_name, is_nullable,
              character_maximum_length, numeric_precision, numeric_scale
            from information_schema.columns
            where table_schema = 'public'
            order by table_name, ordinal_position
            limit ${MAX_SCHEMA_CATALOG_ROWS + 1}
          `),
          client.query<{
            table_name: string;
            constraint_name: string;
            constraint_type: string;
            definition: string;
          }>(`
            select c.relname as table_name, con.conname as constraint_name,
              con.contype::text as constraint_type, pg_get_constraintdef(con.oid, true) as definition
            from pg_constraint con
            join pg_class c on c.oid = con.conrelid
            join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'public' and c.relkind in ('r', 'p')
            order by c.relname, con.conname
            limit ${MAX_SCHEMA_CATALOG_ROWS + 1}
          `),
          client.query<{ table_name: string; index_name: string; definition: string }>(`
            select tablename as table_name, indexname as index_name, indexdef as definition
            from pg_indexes
            where schemaname = 'public'
            order by tablename, indexname
            limit ${MAX_SCHEMA_CATALOG_ROWS + 1}
          `),
          client.query<{ enum_name: string; enum_value: string }>(`
            select t.typname as enum_name, e.enumlabel as enum_value
            from pg_type t
            join pg_namespace n on n.oid = t.typnamespace
            join pg_enum e on e.enumtypid = t.oid
            where n.nspname = 'public'
            order by t.typname, e.enumsortorder
            limit ${MAX_SCHEMA_CATALOG_ROWS + 1}
          `),
        ]);
        const catalogRows = [
          columnResult.rows.length,
          constraintResult.rows.length,
          indexResult.rows.length,
          enumValueResult.rows.length,
        ];
        if (tableNames.length > 200 || catalogRows.some((count) => count > MAX_SCHEMA_CATALOG_ROWS)) {
          throw new Error("staging schema catalog exceeds the bounded response limits");
        }

        const enumValues = new Map<string, string[]>();
        for (const row of enumValueResult.rows) {
          const values = enumValues.get(row.enum_name) ?? [];
          values.push(row.enum_value);
          enumValues.set(row.enum_name, values);
        }
        schemaCatalog = {
          tables: tableNames,
          columns: columnResult.rows.map((row) => ({
            table: row.table_name,
            name: row.column_name,
            type: row.udt_name,
            nullable: row.is_nullable === "YES",
            maxLength: row.character_maximum_length,
            numericPrecision: row.numeric_precision,
            numericScale: row.numeric_scale,
          })),
          constraints: constraintResult.rows.map((row) => ({
            table: row.table_name,
            name: row.constraint_name,
            type: row.constraint_type,
            definition: row.definition,
          })),
          indexes: indexResult.rows.map((row) => ({
            table: row.table_name,
            name: row.index_name,
            definition: row.definition,
          })),
          enums: [...enumValues.entries()].map(([name, values]) => ({ name, values })),
        };
        if (Buffer.byteLength(JSON.stringify(schemaCatalog), "utf8") > MAX_SCHEMA_CATALOG_BYTES) {
          throw new Error("staging schema catalog exceeds the bounded response size");
        }
      }

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
            provider: databaseProvider,
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
            pendingCount: migrationState.pendingCount,
            unfinishedCount: unfinishedMigrations.length,
            expectedCount: EXPECTED_PRISMA_MIGRATIONS.length,
            exactReviewedPrefix: true,
            documentRevision: {
              migrationApplied: migrationState.documentRevisionApplied,
              schemaReady: migrationState.documentRevisionApplied,
            },
            commerce: {
              foundationMigrationApplied: migrationState.commerceFoundationApplied,
              idempotencyMigrationApplied: migrationState.commerceIdempotencyApplied,
              stripeMigrationApplied: migrationState.commerceStripeApplied,
              sessionRecoveryMigrationApplied: migrationState.commerceSessionRecoveryApplied,
              sessionRecoveryAuditMigrationApplied: migrationState.commerceSessionRecoveryAuditApplied,
              tablesPresent: commerceTablesPresent.length,
              tablesExpected: COMMERCE_TABLES.length,
              enumsPresent: commerceEnumsPresent.length,
              enumsExpected: COMMERCE_ENUMS.length,
              checkoutRequestIdPresent: commerceCheckoutRequestIdPresent,
              stripeCheckoutSessionIdPresent: commerceStripeSessionIdPresent,
              previousPlanIdPresent: commercePreviousPlanIdPresent,
              recoveryAttemptMarkerPresent: commerceRecoveryAttemptMarkerPresent,
              recoveryAuditTablePresent: commerceRecoveryAuditTablePresent,
              schemaReady: migrationState.commerceReady,
              recoveryReady: migrationState.commerceRecoveryReady,
            },
            pass: true,
          },
          betterAuth: {
            present: presentBetterAuthTables.length,
            expected: BETTER_AUTH_TABLES.length,
            state: betterAuthState,
          },
          ...(schemaCatalog ? { schemaCatalog } : {}),
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
