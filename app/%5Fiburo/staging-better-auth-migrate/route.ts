import { createHash } from "node:crypto";

import { Pool, type PoolClient } from "pg";
import { requireStagingDatabaseTarget } from "@/scripts/staging-target-guard";
import {
  VERCEL_STAGING_BRANCH,
  isVercelPreviewBackendAllowed,
} from "@/server/config/vercel-preview-boundary";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BETTER_AUTH_SCHEMA = "public";
const REQUIRED_TABLES = [
  "user",
  "session",
  "account",
  "verification",
  "twoFactor",
  "rateLimit",
] as const;
const ADVISORY_LOCK_KEY = "iburo127:staging:better-auth:1.7.2";
const EXPECTED_SQL_SHA256 = "86704c8b960e667eecb8b87f588fe93a2be07faba9f10025e44a9104f6f77deb";
const EXACT_GIT_SHA_PATTERN = /^[a-f0-9]{40}$/i;

const REVIEWED_SQL = `create table "user" ("id" text not null primary key, "name" text not null, "email" text not null unique, "emailVerified" boolean not null, "image" text, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz default CURRENT_TIMESTAMP not null, "twoFactorEnabled" boolean);

create table "session" ("id" text not null primary key, "expiresAt" timestamptz not null, "token" text not null unique, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz not null, "ipAddress" text, "userAgent" text, "userId" text not null references "user" ("id") on delete cascade);

create table "account" ("id" text not null primary key, "issuer" text not null, "accountId" text not null, "providerId" text not null, "userId" text not null references "user" ("id") on delete cascade, "accessToken" text, "refreshToken" text, "idToken" text, "accessTokenExpiresAt" timestamptz, "refreshTokenExpiresAt" timestamptz, "scope" text, "password" text, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz not null);

create table "verification" ("id" text not null primary key, "identifier" text not null, "value" text not null, "expiresAt" timestamptz not null, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz default CURRENT_TIMESTAMP not null);

create table "twoFactor" ("id" text not null primary key, "secret" text not null, "backupCodes" text not null, "userId" text not null references "user" ("id") on delete cascade, "verified" boolean, "failedVerificationCount" integer, "lockedUntil" timestamptz);

create table "rateLimit" ("id" text not null primary key, "key" text not null unique, "count" integer not null, "lastRequest" bigint not null);

create index "session_userId_idx" on "session" ("userId");

create index "account_userId_idx" on "account" ("userId");

create index "verification_identifier_idx" on "verification" ("identifier");

create index "twoFactor_secret_idx" on "twoFactor" ("secret");

create index "twoFactor_userId_idx" on "twoFactor" ("userId");

create unique index "account_issuer_accountId_uidx" on "account" ("issuer", "accountId");
`;

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

type FailureStage =
  | "preview-boundary"
  | "target"
  | "configuration"
  | "origin"
  | "confirmation"
  | "connect"
  | "begin"
  | "lock"
  | "identity"
  | "baseline"
  | "migration"
  | "verification"
  | "commit";

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

function embeddedSqlSha256(): string {
  return createHash("sha256").update(REVIEWED_SQL).digest("hex");
}

function safeJson(status: number, body: Record<string, unknown>) {
  return Response.json(body, { status, headers: NO_STORE_HEADERS });
}

function fail(stage: FailureStage, status = 503) {
  return safeJson(status, {
    service: "iburo127",
    operation: "staging-better-auth-migrate",
    pass: false,
    failureStage: stage,
  });
}

function htmlEscape(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function migrationConfigReady(env: NodeJS.ProcessEnv, databaseName: string): boolean {
  return (
    embeddedSqlSha256() === EXPECTED_SQL_SHA256 &&
    env.IB_STAGING_BETTER_AUTH_SCHEMA?.trim() === BETTER_AUTH_SCHEMA &&
    env.IB_STAGING_BETTER_AUTH_SQL_SHA256?.trim().toLowerCase() === EXPECTED_SQL_SHA256 &&
    env.IB_STAGING_BETTER_AUTH_MIGRATION_CONFIRM?.trim() ===
      `BETTER_AUTH:${databaseName}:${BETTER_AUTH_SCHEMA}`
  );
}

async function readBetterAuthBaseline(databaseUrl: string, expectedDatabaseName: string) {
  const pool = new Pool({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 10_000,
    statement_timeout: 10_000,
    max: 1,
  });

  try {
    const client = await pool.connect();
    try {
      await client.query("BEGIN READ ONLY");
      const identity = await client.query<{ database_name: string; current_schema: string | null }>(
        "select current_database() as database_name, current_schema() as current_schema",
      );
      const identityRow = identity.rows[0];
      const tables = await client.query<{ table_name: string }>(
        `
          select table_name
          from information_schema.tables
          where table_schema = $1
            and table_type = 'BASE TABLE'
            and table_name = any($2::text[])
          order by table_name
        `,
        [BETTER_AUTH_SCHEMA, [...REQUIRED_TABLES]],
      );
      await client.query("ROLLBACK");
      return {
        identityPass:
          identityRow?.database_name === expectedDatabaseName &&
          identityRow.current_schema === BETTER_AUTH_SCHEMA,
        presentTables: tables.rows.map((row) => row.table_name),
      };
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // Preserve the original read-only preflight failure.
      }
      throw error;
    } finally {
      client.release();
    }
  } finally {
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

  let baseline: Awaited<ReturnType<typeof readBetterAuthBaseline>>;
  try {
    baseline = await readBetterAuthBaseline(target.databaseUrl, target.expectedDatabaseName);
  } catch {
    return fail("connect");
  }

  const sha = exactPreviewCommitSha(env);
  const configReady = migrationConfigReady(env, target.expectedDatabaseName);
  const baselineClean = baseline.identityPass && baseline.presentTables.length === 0;
  const baselineComplete =
    baseline.identityPass && baseline.presentTables.length === REQUIRED_TABLES.length;
  const ready = Boolean(sha && configReady && baselineClean);
  const confirmation = sha
    ? `APPLY_BETTER_AUTH:${target.expectedDatabaseName}:${BETTER_AUTH_SCHEMA}:${sha}`
    : "";

  const statusText = baselineComplete
    ? "Better Auth schema is already 6/6. Do not replay migration."
    : ready
      ? "All guarded preconditions passed. POST migration is enabled."
      : "Migration is blocked because one or more guarded preconditions failed.";

  const form = ready
    ? `<form method="post"><input type="hidden" name="confirm" value="${htmlEscape(confirmation)}"><button type="submit">Run guarded staging Better Auth migration</button></form>`
    : "";

  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><title>iБюро staging Better Auth migration</title></head><body><main><h1>iБюро staging Better Auth migration</h1><p>${htmlEscape(statusText)}</p><ul><li>environment: preview</li><li>branch: ${htmlEscape(VERCEL_STAGING_BRANCH)}</li><li>commit: ${htmlEscape(sha ?? "unavailable")}</li><li>database: ${htmlEscape(target.expectedDatabaseName)}</li><li>schema: ${BETTER_AUTH_SCHEMA}</li><li>embedded SQL SHA-256: ${EXPECTED_SQL_SHA256}</li><li>configuration ready: ${String(configReady)}</li><li>database identity pass: ${String(baseline.identityPass)}</li><li>Better Auth tables present: ${baseline.presentTables.length}/${REQUIRED_TABLES.length}</li></ul>${form}</main></body></html>`,
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

  if (!migrationConfigReady(env, target.expectedDatabaseName)) {
    return fail("configuration");
  }

  const requestUrl = new URL(request.url);
  const origin = request.headers.get("origin");
  if (!origin || origin !== requestUrl.origin) return fail("origin", 403);

  const sha = exactPreviewCommitSha(env);
  if (!sha) return fail("preview-boundary", 404);

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return fail("confirmation", 400);
  }
  const expectedRequestConfirmation =
    `APPLY_BETTER_AUTH:${target.expectedDatabaseName}:${BETTER_AUTH_SCHEMA}:${sha}`;
  if (formData.get("confirm") !== expectedRequestConfirmation) {
    return fail("confirmation", 403);
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
    const identityRow = identity.rows[0];
    if (
      !identityRow ||
      identityRow.database_name !== target.expectedDatabaseName ||
      identityRow.current_schema !== BETTER_AUTH_SCHEMA
    ) {
      throw new Error("staging database identity mismatch");
    }

    failureStage = "baseline";
    const existing = await client.query<{ table_name: string }>(
      `
        select table_name
        from information_schema.tables
        where table_schema = $1
          and table_type = 'BASE TABLE'
          and table_name = any($2::text[])
        order by table_name
      `,
      [BETTER_AUTH_SCHEMA, [...REQUIRED_TABLES]],
    );
    if (existing.rows.length !== 0) {
      throw new Error("Better Auth schema baseline is not clean");
    }

    failureStage = "migration";
    await client.query(REVIEWED_SQL);

    failureStage = "verification";
    const created = await client.query<{ table_name: string }>(
      `
        select table_name
        from information_schema.tables
        where table_schema = $1
          and table_type = 'BASE TABLE'
          and table_name = any($2::text[])
        order by table_name
      `,
      [BETTER_AUTH_SCHEMA, [...REQUIRED_TABLES]],
    );
    if (created.rows.length !== REQUIRED_TABLES.length) {
      throw new Error("Better Auth schema post-migration table count mismatch");
    }

    failureStage = "commit";
    await client.query("COMMIT");
    transactionOpen = false;

    return safeJson(200, {
      service: "iburo127",
      operation: "staging-better-auth-migrate",
      environment: "preview",
      branch: VERCEL_STAGING_BRANCH,
      commitSha: sha,
      runtimeTarget: "staging",
      database: target.expectedDatabaseName,
      schema: BETTER_AUTH_SCHEMA,
      sqlSha256: EXPECTED_SQL_SHA256,
      createdTables: REQUIRED_TABLES.length,
      pass: true,
    });
  } catch {
    if (transactionOpen && client) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // Preserve the bounded failure stage without exposing database errors.
      }
    }
    return fail(failureStage);
  } finally {
    client?.release();
    await pool.end();
  }
}
