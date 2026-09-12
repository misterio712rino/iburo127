import { PrismaPg } from "@prisma/adapter-pg";
import { Pool, type PoolClient } from "pg";

import { PrismaClient } from "@/generated/prisma/client";
import { requireStagingDatabaseTarget } from "@/scripts/staging-target-guard";
import {
  VERCEL_STAGING_BRANCH,
  isVercelPreviewBackendAllowed,
} from "@/server/config/vercel-preview-boundary";
import {
  inspectDomainFixtures,
  seedDemoData,
  seedReferenceData,
} from "@/server/staging/domain-fixtures";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SCHEMA = "public";
const ADVISORY_LOCK_KEY = "iburo127:staging:domain-fixtures:v1";
const EXACT_GIT_SHA_PATTERN = /^[a-f0-9]{40}$/i;

type FailureStage =
  | "preview-boundary"
  | "target"
  | "configuration"
  | "origin"
  | "confirmation"
  | "connect"
  | "lock"
  | "identity"
  | "seed"
  | "verification";

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex",
};

const HTML_HEADERS = {
  ...NO_STORE_HEADERS,
  "Content-Type": "text/html; charset=utf-8",
  "Content-Security-Policy":
    "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
};

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

function htmlEscape(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeJson(status: number, body: Record<string, unknown>) {
  return Response.json(body, { status, headers: NO_STORE_HEADERS });
}

function fail(stage: FailureStage, status = 503) {
  return safeJson(status, {
    service: "iburo127",
    operation: "staging-domain-fixtures",
    pass: false,
    failureStage: stage,
  });
}

function readSeedConfiguration(env: NodeJS.ProcessEnv, databaseName: string) {
  const referenceReady =
    env.IB_STAGING_REFERENCE_SEED_CONFIRM?.trim() === `REFERENCE-SEED:${databaseName}`;
  const demoReady = env.IB_STAGING_DEMO_SEED_CONFIRM?.trim() === `DEMO-SEED:${databaseName}`;
  return {
    referenceReady,
    demoReady,
    ready: referenceReady && demoReady,
  };
}

function newPrisma(databaseUrl: string) {
  const adapter = new PrismaPg({ connectionString: databaseUrl });
  return new PrismaClient({ adapter });
}

async function readDatabaseIdentity(
  databaseUrl: string,
  expectedDatabaseName: string,
): Promise<boolean> {
  const pool = new Pool({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 10_000,
    statement_timeout: 10_000,
    max: 1,
  });
  let client: PoolClient | null = null;
  try {
    client = await pool.connect();
    await client.query("BEGIN READ ONLY");
    const result = await client.query<{ database_name: string; current_schema: string | null }>(
      "select current_database() as database_name, current_schema() as current_schema",
    );
    await client.query("ROLLBACK");
    const row = result.rows[0];
    return row?.database_name === expectedDatabaseName && row.current_schema === SCHEMA;
  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // Preserve original read-only failure.
      }
    }
    throw error;
  } finally {
    client?.release();
    await pool.end();
  }
}

export async function GET() {
  const env = process.env;
  if (!isExactStagingPreview(env)) return fail("preview-boundary", 404);

  let target: ReturnType<typeof requireStagingDatabaseTarget>;
  try {
    target = requireStagingDatabaseTarget(env);
  } catch {
    return fail("target");
  }

  const configuration = readSeedConfiguration(env, target.expectedDatabaseName);

  let identityPass = false;
  let inspection: Awaited<ReturnType<typeof inspectDomainFixtures>>;
  const prisma = newPrisma(target.databaseUrl);
  try {
    identityPass = await readDatabaseIdentity(target.databaseUrl, target.expectedDatabaseName);
    inspection = await inspectDomainFixtures(prisma);
  } catch {
    return fail("connect");
  } finally {
    await prisma.$disconnect();
  }

  const sha = exactPreviewCommitSha(env);
  const safeToSeed = Boolean(sha) && configuration.ready && identityPass;
  const requestConfirmation = sha
    ? `SEED_DOMAIN_FIXTURES:${target.expectedDatabaseName}:${SCHEMA}:${sha}`
    : "";
  const form = safeToSeed
    ? `<form method="post"><input type="hidden" name="confirm" value="${htmlEscape(requestConfirmation)}"><button type="submit">Seed guarded staging domain fixtures</button></form>`
    : "";

  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><title>iБюро staging domain fixtures</title></head><body><main><h1>iБюро staging domain fixtures</h1><p>${safeToSeed ? "All guarded preconditions passed. POST seed is enabled." : "Seed is blocked because one or more guarded preconditions failed."}</p><ul><li>environment: preview</li><li>branch: ${htmlEscape(VERCEL_STAGING_BRANCH)}</li><li>commit: ${htmlEscape(sha ?? "unavailable")}</li><li>database: ${htmlEscape(target.expectedDatabaseName)}</li><li>schema: ${SCHEMA}</li><li>reference confirmation ready: ${String(configuration.referenceReady)}</li><li>demo confirmation ready: ${String(configuration.demoReady)}</li><li>database identity pass: ${String(identityPass)}</li><li>read only: true</li></ul><pre>${htmlEscape(JSON.stringify(inspection, null, 2))}</pre>${form}</main></body></html>`,
    { status: 200, headers: HTML_HEADERS },
  );
}

export async function POST(request: Request) {
  const env = process.env;
  if (!isExactStagingPreview(env)) return fail("preview-boundary", 404);

  let target: ReturnType<typeof requireStagingDatabaseTarget>;
  try {
    target = requireStagingDatabaseTarget(env);
  } catch {
    return fail("target");
  }

  const configuration = readSeedConfiguration(env, target.expectedDatabaseName);
  if (!configuration.ready) return fail("configuration");

  const requestUrl = new URL(request.url);
  const origin = request.headers.get("origin");
  const secFetchSite = request.headers.get("sec-fetch-site");
  if (origin !== requestUrl.origin && secFetchSite !== "same-origin") {
    return fail("origin", 403);
  }

  const sha = exactPreviewCommitSha(env);
  if (!sha) return fail("preview-boundary", 404);

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return fail("confirmation", 400);
  }
  const expectedConfirmation =
    `SEED_DOMAIN_FIXTURES:${target.expectedDatabaseName}:${SCHEMA}:${sha}`;
  if (formData.get("confirm") !== expectedConfirmation) {
    return fail("confirmation", 403);
  }

  const lockPool = new Pool({
    connectionString: target.databaseUrl,
    connectionTimeoutMillis: 10_000,
    statement_timeout: 30_000,
    max: 1,
  });
  let lockClient: PoolClient | null = null;
  let lockHeld = false;
  let failureStage: FailureStage = "connect";
  const prisma = newPrisma(target.databaseUrl);

  try {
    lockClient = await lockPool.connect();
    failureStage = "lock";
    await lockClient.query("select pg_advisory_lock(hashtext($1))", [ADVISORY_LOCK_KEY]);
    lockHeld = true;

    failureStage = "identity";
    const identity = await lockClient.query<{ database_name: string; current_schema: string | null }>(
      "select current_database() as database_name, current_schema() as current_schema",
    );
    const identityRow = identity.rows[0];
    if (
      identityRow?.database_name !== target.expectedDatabaseName ||
      identityRow.current_schema !== SCHEMA
    ) {
      throw new Error("staging database identity mismatch");
    }

    failureStage = "seed";
    const verified = await prisma.$transaction(
      async (tx) => {
        await seedReferenceData(tx);
        await seedDemoData(tx);
        return inspectDomainFixtures(tx);
      },
      { timeout: 30_000 },
    );

    failureStage = "verification";
    if (!verified.pass) throw new Error("staging domain fixture verification failed");

    return safeJson(200, {
      service: "iburo127",
      operation: "staging-domain-fixtures",
      environment: "preview",
      branch: VERCEL_STAGING_BRANCH,
      commitSha: sha,
      runtimeTarget: "staging",
      database: target.expectedDatabaseName,
      schema: SCHEMA,
      reference: verified.reference,
      demo: verified.demo,
      pass: true,
    });
  } catch {
    return fail(failureStage);
  } finally {
    if (lockHeld && lockClient) {
      try {
        await lockClient.query("select pg_advisory_unlock(hashtext($1))", [ADVISORY_LOCK_KEY]);
      } catch {
        // Connection teardown releases a session-level advisory lock if explicit unlock fails.
      }
    }
    lockClient?.release();
    await lockPool.end();
    await prisma.$disconnect();
  }
}
