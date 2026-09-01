import { createHash, randomUUID } from "node:crypto";

import { Pool, type PoolClient } from "pg";
import { requireStagingDatabaseTarget } from "@/scripts/staging-target-guard";
import {
  VERCEL_STAGING_BRANCH,
  isVercelPreviewBackendAllowed,
} from "@/server/config/vercel-preview-boundary";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MIGRATION_NAME = "20260901_access_gate_leads";
const MIGRATION_SQL = `CREATE TYPE "PotentialClientLeadContactType" AS ENUM ('EMAIL', 'PHONE');
CREATE TYPE "PotentialClientLeadStatus" AS ENUM ('NEW', 'CONVERTED', 'ARCHIVED');

CREATE TABLE "PotentialClientLead" (
    "id" UUID NOT NULL,
    "contactType" "PotentialClientLeadContactType" NOT NULL,
    "contactKey" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "source" TEXT NOT NULL DEFAULT 'AUTH_GATE',
    "status" "PotentialClientLeadStatus" NOT NULL DEFAULT 'NEW',
    "attemptCount" INTEGER NOT NULL DEFAULT 1,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PotentialClientLead_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PotentialClientLead_contactKey_key" ON "PotentialClientLead"("contactKey");
CREATE INDEX "PotentialClientLead_status_lastSeenAt_idx" ON "PotentialClientLead"("status", "lastSeenAt");
CREATE INDEX "PotentialClientLead_contactType_lastSeenAt_idx" ON "PotentialClientLead"("contactType", "lastSeenAt");
`;
const EXPECTED_SQL_SHA256 = "bbb60f3e7207a9ea986bef9d5624af0b3ba4b0c265fe6d80e17d950ddb623a9a";
const EXPECTED_INITIAL_MIGRATION = "20260831_initial_baseline";
const ADVISORY_LOCK_KEY = "iburo127:staging:access-gate-leads:v1";
const EXACT_SHA = /^[a-f0-9]{40}$/;
const EXPECTED_INDEXES = [
  "PotentialClientLead_pkey",
  "PotentialClientLead_contactKey_key",
  "PotentialClientLead_status_lastSeenAt_idx",
  "PotentialClientLead_contactType_lastSeenAt_idx",
] as const;

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex",
};

type FailureStage =
  | "preview-boundary"
  | "target"
  | "confirmation"
  | "connect"
  | "begin"
  | "lock"
  | "identity"
  | "history-baseline"
  | "schema-baseline"
  | "migration"
  | "history-write"
  | "verification"
  | "commit";

function safeJson(status: number, body: Record<string, unknown>) {
  return Response.json(body, { status, headers: NO_STORE_HEADERS });
}

function fail(stage: FailureStage, status = 503) {
  return safeJson(status, {
    service: "iburo127",
    operation: "staging-access-gate-migrate",
    pass: false,
    failureStage: stage,
  });
}

function exactPreviewSha(env: NodeJS.ProcessEnv): string | null {
  const sha = env.VERCEL_GIT_COMMIT_SHA?.trim().toLowerCase() ?? "";
  return EXACT_SHA.test(sha) ? sha : null;
}

function isExactStagingPreview(env: NodeJS.ProcessEnv): boolean {
  return (
    env.VERCEL_ENV?.trim() === "preview" &&
    env.VERCEL_GIT_COMMIT_REF?.trim() === VERCEL_STAGING_BRANCH &&
    env.IB_RUNTIME_TARGET?.trim() === "staging" &&
    exactPreviewSha(env) !== null &&
    isVercelPreviewBackendAllowed(env)
  );
}

function migrationChecksum(): string {
  return createHash("sha256").update(MIGRATION_SQL).digest("hex");
}

async function readAppliedHistory(client: PoolClient) {
  return client.query<{
    migration_name: string;
    checksum: string;
    finished_at: Date | null;
    rolled_back_at: Date | null;
    applied_steps_count: number;
  }>(`
    select migration_name, checksum, finished_at, rolled_back_at, applied_steps_count
    from public."_prisma_migrations"
    order by started_at, migration_name
  `);
}

async function schemaArtifacts(client: PoolClient) {
  const table = await client.query<{ exists: boolean }>(`
    select to_regclass('public."PotentialClientLead"') is not null as exists
  `);
  const enums = await client.query<{ name: string }>(`
    select t.typname as name
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = any($1::text[])
    order by t.typname
  `, [["PotentialClientLeadContactType", "PotentialClientLeadStatus"]]);
  const indexes = await client.query<{ indexname: string }>(`
    select indexname
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'PotentialClientLead'
    order by indexname
  `);
  return {
    tableExists: table.rows[0]?.exists === true,
    enums: enums.rows.map((row) => row.name),
    indexes: indexes.rows.map((row) => row.indexname),
  };
}

export async function POST(request: Request) {
  const env = process.env;
  if (!isExactStagingPreview(env)) return fail("preview-boundary", 404);
  const sha = exactPreviewSha(env);
  if (!sha) return fail("preview-boundary", 404);

  if (migrationChecksum() !== EXPECTED_SQL_SHA256) return fail("confirmation");
  if (
    request.headers.get("x-iburo-staging-migration-confirm") !==
    `APPLY:${MIGRATION_NAME}:${sha}`
  ) {
    return fail("confirmation", 403);
  }

  let target: ReturnType<typeof requireStagingDatabaseTarget>;
  try {
    target = requireStagingDatabaseTarget(env);
  } catch {
    return fail("target");
  }

  const pool = new Pool({
    connectionString: target.databaseUrl,
    connectionTimeoutMillis: 10_000,
    statement_timeout: 30_000,
    max: 1,
  });
  let client: PoolClient | null = null;
  let transactionOpen = false;
  let failureStage: FailureStage = "connect";

  try {
    client = await pool.connect();
    failureStage = "begin";
    await client.query("BEGIN");
    transactionOpen = true;

    failureStage = "lock";
    await client.query("select pg_advisory_xact_lock(hashtext($1))", [ADVISORY_LOCK_KEY]);

    failureStage = "identity";
    const identity = await client.query<{ database_name: string; current_schema: string | null }>(
      "select current_database() as database_name, current_schema() as current_schema",
    );
    if (
      identity.rows[0]?.database_name !== target.expectedDatabaseName ||
      identity.rows[0]?.current_schema !== "public"
    ) {
      throw new Error("identity mismatch");
    }

    failureStage = "history-baseline";
    const history = await readAppliedHistory(client);
    if (
      history.rows.length !== 1 ||
      history.rows[0]?.migration_name !== EXPECTED_INITIAL_MIGRATION ||
      !history.rows[0]?.finished_at ||
      history.rows[0]?.rolled_back_at ||
      history.rows[0]?.applied_steps_count !== 1
    ) {
      throw new Error("unexpected migration baseline");
    }

    failureStage = "schema-baseline";
    const before = await schemaArtifacts(client);
    if (before.tableExists || before.enums.length !== 0 || before.indexes.length !== 0) {
      throw new Error("lead schema is not clean");
    }

    failureStage = "migration";
    await client.query(MIGRATION_SQL);

    failureStage = "history-write";
    const migrationId = randomUUID();
    await client.query(
      `insert into public."_prisma_migrations"
        (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
       values ($1, $2, now(), $3, null, null, now(), 1)`,
      [migrationId, EXPECTED_SQL_SHA256, MIGRATION_NAME],
    );

    failureStage = "verification";
    const after = await schemaArtifacts(client);
    if (!after.tableExists) throw new Error("lead table missing after migration");
    if (
      after.enums.join(",") !==
      ["PotentialClientLeadContactType", "PotentialClientLeadStatus"].sort().join(",")
    ) {
      throw new Error("lead enums incomplete");
    }
    if (
      [...EXPECTED_INDEXES].sort().join(",") !== [...after.indexes].sort().join(",")
    ) {
      throw new Error("lead indexes incomplete");
    }

    const updatedHistory = await readAppliedHistory(client);
    const newEntry = updatedHistory.rows.find((row) => row.migration_name === MIGRATION_NAME);
    if (
      updatedHistory.rows.length !== 2 ||
      !newEntry ||
      newEntry.checksum !== EXPECTED_SQL_SHA256 ||
      !newEntry.finished_at ||
      newEntry.rolled_back_at ||
      newEntry.applied_steps_count !== 1
    ) {
      throw new Error("migration history verification failed");
    }

    failureStage = "commit";
    await client.query("COMMIT");
    transactionOpen = false;

    return safeJson(200, {
      service: "iburo127",
      operation: "staging-access-gate-migrate",
      environment: "preview",
      branch: VERCEL_STAGING_BRANCH,
      commitSha: sha,
      runtimeTarget: "staging",
      database: target.expectedDatabaseName,
      migration: MIGRATION_NAME,
      migrationChecksum: EXPECTED_SQL_SHA256,
      migrationCount: 2,
      tableReady: true,
      enumsReady: true,
      indexesReady: true,
      valuesPrinted: false,
      pass: true,
    });
  } catch {
    if (transactionOpen && client) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // Preserve the bounded failure stage.
      }
    }
    return fail(failureStage);
  } finally {
    client?.release();
    await pool.end();
  }
}
