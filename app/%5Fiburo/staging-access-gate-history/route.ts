import { Pool } from "pg";

import { requireStagingDatabaseTarget } from "@/scripts/staging-target-guard";
import {
  VERCEL_STAGING_BRANCH,
  isVercelPreviewBackendAllowed,
} from "@/server/config/vercel-preview-boundary";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const EXACT_SHA = /^[a-f0-9]{40}$/;
const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex",
};

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

export async function GET() {
  const env = process.env;
  if (!isExactStagingPreview(env)) {
    return Response.json({ pass: false }, { status: 404, headers: NO_STORE_HEADERS });
  }

  let target: ReturnType<typeof requireStagingDatabaseTarget>;
  try {
    target = requireStagingDatabaseTarget(env);
  } catch {
    return Response.json({ pass: false }, { status: 503, headers: NO_STORE_HEADERS });
  }

  const pool = new Pool({
    connectionString: target.databaseUrl,
    connectionTimeoutMillis: 10_000,
    statement_timeout: 30_000,
    max: 1,
  });

  try {
    const history = await pool.query<{
      migration_name: string;
      finished: boolean;
      rolled_back: boolean;
      applied_steps_count: number;
    }>(`
      select
        migration_name,
        finished_at is not null as finished,
        rolled_back_at is not null as rolled_back,
        applied_steps_count
      from public."_prisma_migrations"
      order by started_at, migration_name
    `);

    const schema = await pool.query<{
      table_exists: boolean;
      enum_count: number;
      index_count: number;
    }>(`
      select
        to_regclass('public."PotentialClientLead"') is not null as table_exists,
        (
          select count(*)::int
          from pg_type t
          join pg_namespace n on n.oid = t.typnamespace
          where n.nspname = 'public'
            and t.typname in ('PotentialClientLeadContactType', 'PotentialClientLeadStatus')
        ) as enum_count,
        (
          select count(*)::int
          from pg_indexes
          where schemaname = 'public'
            and tablename = 'PotentialClientLead'
        ) as index_count
    `);

    return Response.json(
      {
        service: "iburo127",
        operation: "staging-access-gate-history",
        branch: VERCEL_STAGING_BRANCH,
        commitSha: exactPreviewSha(env),
        database: target.expectedDatabaseName,
        migrations: history.rows.map((row) => ({
          name: row.migration_name,
          finished: row.finished,
          rolledBack: row.rolled_back,
          steps: row.applied_steps_count,
        })),
        schema: {
          tableExists: schema.rows[0]?.table_exists === true,
          enumCount: Number(schema.rows[0]?.enum_count ?? 0),
          indexCount: Number(schema.rows[0]?.index_count ?? 0),
        },
        valuesPrinted: false,
        pass: true,
      },
      { headers: NO_STORE_HEADERS },
    );
  } catch {
    return Response.json({ pass: false }, { status: 503, headers: NO_STORE_HEADERS });
  } finally {
    await pool.end();
  }
}
