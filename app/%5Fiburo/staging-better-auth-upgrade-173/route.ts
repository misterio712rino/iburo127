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
const ADVISORY_LOCK_KEY = "iburo127:staging:better-auth:1.7.3";
const LEGACY_INDEX = "account_issuer_accountId_uidx";
const REVIEWED_SQL = `ALTER TABLE "account" ALTER COLUMN "issuer" DROP NOT NULL;\nDROP INDEX "account_issuer_accountId_uidx";\n`;
const EXPECTED_SQL_SHA256 = "4b5d4928e9f726d8fdf3ce390d34b994e0dbf977b95d8123f9d0a8241fcc1c57";
const EXACT_GIT_SHA_PATTERN = /^[a-f0-9]{40}$/i;

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
  | "duplicates"
  | "migration"
  | "verification"
  | "commit";

type Baseline = {
  identityPass: boolean;
  accountTablePresent: boolean;
  issuerPresent: boolean;
  issuerNullable: boolean | null;
  legacyIndexPresent: boolean;
  duplicateProviderAccounts: number;
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

function embeddedSqlSha256(): string {
  return createHash("sha256").update(REVIEWED_SQL).digest("hex");
}

function safeJson(status: number, body: Record<string, unknown>) {
  return Response.json(body, { status, headers: NO_STORE_HEADERS });
}

function fail(stage: FailureStage, status = 503) {
  return safeJson(status, {
    service: "iburo127",
    operation: "staging-better-auth-upgrade-173",
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

function configReady(env: NodeJS.ProcessEnv): boolean {
  return (
    embeddedSqlSha256() === EXPECTED_SQL_SHA256 &&
    env.IB_STAGING_BETTER_AUTH_SCHEMA?.trim() === BETTER_AUTH_SCHEMA
  );
}

async function inspectBaseline(
  client: PoolClient,
  expectedDatabaseName: string,
): Promise<Baseline> {
  const identity = await client.query<{ database_name: string; current_schema: string | null }>(
    "select current_database() as database_name, current_schema() as current_schema",
  );
  const identityRow = identity.rows[0];

  const accountTable = await client.query<{ present: boolean }>(
    `select to_regclass($1) is not null as present`,
    [`${BETTER_AUTH_SCHEMA}.account`],
  );
  const accountTablePresent = accountTable.rows[0]?.present === true;

  let issuerPresent = false;
  let issuerNullable: boolean | null = null;
  let legacyIndexPresent = false;
  let duplicateProviderAccounts = 0;

  if (accountTablePresent) {
    const issuer = await client.query<{ is_nullable: "YES" | "NO" }>(
      `
        select is_nullable
        from information_schema.columns
        where table_schema = $1
          and table_name = 'account'
          and column_name = 'issuer'
      `,
      [BETTER_AUTH_SCHEMA],
    );
    issuerPresent = issuer.rowCount === 1;
    issuerNullable = issuerPresent ? issuer.rows[0]?.is_nullable === "YES" : null;

    const legacyIndex = await client.query<{ present: boolean }>(
      `select to_regclass($1) is not null as present`,
      [`${BETTER_AUTH_SCHEMA}.${LEGACY_INDEX}`],
    );
    legacyIndexPresent = legacyIndex.rows[0]?.present === true;

    const duplicates = await client.query<{ count: string }>(
      `
        select count(*)::text as count
        from (
          select "providerId", "accountId"
          from "account"
          group by "providerId", "accountId"
          having count(*) > 1
        ) duplicate_accounts
      `,
    );
    duplicateProviderAccounts = Number.parseInt(duplicates.rows[0]?.count ?? "0", 10);
  }

  return {
    identityPass:
      identityRow?.database_name === expectedDatabaseName &&
      identityRow.current_schema === BETTER_AUTH_SCHEMA,
    accountTablePresent,
    issuerPresent,
    issuerNullable,
    legacyIndexPresent,
    duplicateProviderAccounts,
  };
}

function isLegacy173UpgradeBaseline(baseline: Baseline): boolean {
  return (
    baseline.identityPass &&
    baseline.accountTablePresent &&
    baseline.issuerPresent &&
    baseline.issuerNullable === false &&
    baseline.legacyIndexPresent &&
    baseline.duplicateProviderAccounts === 0
  );
}

function isUpgraded173Baseline(baseline: Baseline): boolean {
  return (
    baseline.identityPass &&
    baseline.accountTablePresent &&
    baseline.issuerPresent &&
    baseline.issuerNullable === true &&
    !baseline.legacyIndexPresent &&
    baseline.duplicateProviderAccounts === 0
  );
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

  if (!configReady(env)) return fail("configuration");

  const pool = new Pool({
    connectionString: target.databaseUrl,
    connectionTimeoutMillis: 10_000,
    statement_timeout: 10_000,
    max: 1,
  });

  let baseline: Baseline;
  try {
    const client = await pool.connect();
    try {
      await client.query("BEGIN READ ONLY");
      baseline = await inspectBaseline(client, target.expectedDatabaseName);
      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  } catch {
    return fail("connect");
  } finally {
    await pool.end();
  }

  const sha = exactPreviewCommitSha(env);
  const ready = Boolean(sha && isLegacy173UpgradeBaseline(baseline));
  const alreadyUpgraded = isUpgraded173Baseline(baseline);
  const confirmation = sha
    ? `UPGRADE_BETTER_AUTH_173:${target.expectedDatabaseName}:${BETTER_AUTH_SCHEMA}:${sha}`
    : "";
  const statusText = alreadyUpgraded
    ? "Better Auth account schema is already compatible with 1.7.3. Do not replay upgrade."
    : ready
      ? "Legacy 1.7.0-1.7.2 account schema confirmed with no duplicate provider accounts. Guarded POST upgrade is enabled."
      : "Upgrade is blocked because the exact legacy baseline was not proven.";
  const form = ready
    ? `<form method="post"><input type="hidden" name="confirm" value="${htmlEscape(confirmation)}"><button type="submit">Run guarded staging Better Auth 1.7.3 schema upgrade</button></form>`
    : "";

  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><title>iБюро Better Auth 1.7.3 staging upgrade</title></head><body><main><h1>iБюро Better Auth 1.7.3 staging upgrade</h1><p>${htmlEscape(statusText)}</p><ul><li>environment: preview</li><li>branch: ${htmlEscape(VERCEL_STAGING_BRANCH)}</li><li>commit: ${htmlEscape(sha ?? "unavailable")}</li><li>database: ${htmlEscape(target.expectedDatabaseName)}</li><li>schema: ${BETTER_AUTH_SCHEMA}</li><li>reviewed SQL SHA-256: ${EXPECTED_SQL_SHA256}</li><li>issuer present: ${String(baseline.issuerPresent)}</li><li>issuer nullable: ${String(baseline.issuerNullable)}</li><li>legacy issuer index present: ${String(baseline.legacyIndexPresent)}</li><li>duplicate (providerId, accountId) groups: ${baseline.duplicateProviderAccounts}</li></ul>${form}</main></body></html>`,
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

  if (!configReady(env)) return fail("configuration");

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
    `UPGRADE_BETTER_AUTH_173:${target.expectedDatabaseName}:${BETTER_AUTH_SCHEMA}:${sha}`;
  if (formData.get("confirm") !== expectedConfirmation) return fail("confirmation", 403);

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
    const baseline = await inspectBaseline(client, target.expectedDatabaseName);
    if (!baseline.identityPass) throw new Error("staging database identity mismatch");

    failureStage = "duplicates";
    if (baseline.duplicateProviderAccounts !== 0) {
      throw new Error("duplicate Better Auth provider accounts require manual review");
    }

    failureStage = "baseline";
    if (!isLegacy173UpgradeBaseline(baseline)) {
      throw new Error("Better Auth 1.7.3 legacy baseline mismatch");
    }

    failureStage = "migration";
    await client.query(REVIEWED_SQL);

    failureStage = "verification";
    const upgraded = await inspectBaseline(client, target.expectedDatabaseName);
    if (!isUpgraded173Baseline(upgraded)) {
      throw new Error("Better Auth 1.7.3 post-upgrade verification failed");
    }

    failureStage = "commit";
    await client.query("COMMIT");
    transactionOpen = false;

    return safeJson(200, {
      service: "iburo127",
      operation: "staging-better-auth-upgrade-173",
      environment: "preview",
      branch: VERCEL_STAGING_BRANCH,
      commitSha: sha,
      runtimeTarget: "staging",
      database: target.expectedDatabaseName,
      schema: BETTER_AUTH_SCHEMA,
      sqlSha256: EXPECTED_SQL_SHA256,
      duplicateProviderAccounts: 0,
      issuerNullable: true,
      legacyIndexRemoved: true,
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
