import { randomUUID } from "node:crypto";

import { betterAuth } from "better-auth";
import { Pool, type PoolClient } from "pg";

import { requireStagingDatabaseTarget } from "@/scripts/staging-target-guard";
import { normalizeAccessIdentifier } from "@/server/auth/access-gate-core";
import {
  accessGateRateLimitDigest,
  readTrustedAccessGateClientIp,
} from "@/server/auth/access-gate-rate-limit";
import { readBetterAuthRuntimeConfig } from "@/server/config/production";
import {
  VERCEL_STAGING_BRANCH,
  isVercelPreviewBackendAllowed,
} from "@/server/config/vercel-preview-boundary";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SCHEMA = "public";
const PROVIDER = "better-auth";
const ADVISORY_LOCK_KEY = "iburo127:staging:client-plan-auth-fixtures:v1";
const EXACT_GIT_SHA_PATTERN = /^[a-f0-9]{40}$/i;
const FIXTURES = [
  { label: "CLIENT_LITE", email: "client.lite@example.test", displayName: "Клиент LITE" },
  { label: "CLIENT_PRO", email: "client.pro@example.test", displayName: "Клиент PRO" },
] as const;

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex",
};

type Fixture = (typeof FIXTURES)[number];
type FixtureState = "complete" | "bootstrap-required" | "blocked";
type FailureStage =
  | "preview-boundary"
  | "target"
  | "configuration"
  | "origin"
  | "confirmation"
  | "connect"
  | "lock"
  | "fixture"
  | "verification";

type DomainUser = {
  id: string;
  status: string;
  displayName: string | null;
};

type AuthUser = { id: string };
type Identity = { subject: string };

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

function safeJson(status: number, body: Record<string, unknown>) {
  return Response.json(body, { status, headers: NO_STORE_HEADERS });
}

function fail(stage: FailureStage, status = 503) {
  return safeJson(status, {
    service: "iburo127",
    operation: "staging-client-plan-auth-fixtures",
    pass: false,
    failureStage: stage,
  });
}

function readClientPassword(env: NodeJS.ProcessEnv): string {
  const value = env.IB_STAGING_CLIENT_PASSWORD ?? "";
  if (value.length < 12 || value.length > 128 || value !== value.trim() || /[\r\n\0]/.test(value)) {
    throw new Error("invalid staging client password");
  }
  return value;
}

function assertBootstrapConfiguration(env: NodeJS.ProcessEnv, databaseName: string) {
  if (env.IB_STAGING_BETTER_AUTH_SCHEMA?.trim() !== SCHEMA) {
    throw new Error("invalid Better Auth schema");
  }
  if (
    env.IB_STAGING_AUTH_FIXTURE_BOOTSTRAP_CONFIRM?.trim() !==
    `AUTH-FIXTURES:${databaseName}:${SCHEMA}`
  ) {
    throw new Error("fixture bootstrap confirmation mismatch");
  }
  const auth = readBetterAuthRuntimeConfig(env);
  const hostname = new URL(auth.baseUrl).hostname.toLowerCase().replace(/\.+$/, "");
  if (hostname === "iburo127.ru" || hostname.endsWith(".iburo127.ru")) {
    throw new Error("production Better Auth hostname is blocked");
  }
  return { auth, password: readClientPassword(env) };
}

async function readFixtureState(pool: Pool, fixture: Fixture): Promise<{
  state: FixtureState;
  userId: string | null;
  subject: string | null;
  displayName: string;
}> {
  const domain = await pool.query<DomainUser>(
    `select id::text as id, status::text as status, "displayName" from "User" where lower(email) = lower($1) limit 2`,
    [fixture.email],
  );
  if (domain.rows.length !== 1) {
    return { state: "blocked", userId: null, subject: null, displayName: fixture.displayName };
  }
  const user = domain.rows[0]!;
  const roles = await pool.query<{ code: string }>(
    `select r.code from "UserRole" ur join "Role" r on r.id = ur."roleId" where ur."userId" = $1::uuid order by r.code`,
    [user.id],
  );
  if (user.status !== "ACTIVE" || roles.rows.length !== 1 || roles.rows[0]?.code !== "CLIENT") {
    return { state: "blocked", userId: user.id, subject: null, displayName: user.displayName?.trim() || fixture.displayName };
  }

  const authUsers = await pool.query<AuthUser>(
    `select id from "user" where lower(email) = lower($1) limit 2`,
    [fixture.email],
  );
  const identities = await pool.query<Identity>(
    `select subject from "AuthIdentity" where "userId" = $1::uuid and provider = $2 order by subject`,
    [user.id, PROVIDER],
  );
  const authUser = authUsers.rows[0];
  const complete =
    authUsers.rows.length === 1 &&
    identities.rows.length === 1 &&
    identities.rows[0]?.subject === authUser?.id;
  const clean = authUsers.rows.length === 0 && identities.rows.length === 0;
  return {
    state: complete ? "complete" : clean ? "bootstrap-required" : "blocked",
    userId: user.id,
    subject: complete ? authUser?.id ?? null : null,
    displayName: user.displayName?.trim() || fixture.displayName,
  };
}

async function linkSubject(pool: Pool, userId: string, subject: string) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const locked = await client.query<{ status: string }>(
      `select status::text as status from "User" where id = $1::uuid for update`,
      [userId],
    );
    if (locked.rows[0]?.status !== "ACTIVE") throw new Error("fixture user is not ACTIVE");
    const ownIdentity = await client.query<Identity>(
      `select subject from "AuthIdentity" where "userId" = $1::uuid and provider = $2`,
      [userId, PROVIDER],
    );
    const claimed = await client.query<{ userId: string }>(
      `select "userId"::text as "userId" from "AuthIdentity" where provider = $1 and subject = $2`,
      [PROVIDER, subject],
    );
    if (ownIdentity.rows.length !== 0 || claimed.rows.length !== 0) {
      throw new Error("fixture identity changed concurrently");
    }
    await client.query(
      `insert into "AuthIdentity" (id, "userId", provider, subject, "createdAt", "updatedAt") values ($1::uuid, $2::uuid, $3, $4, now(), now())`,
      [randomUUID(), userId, PROVIDER, subject],
    );
    await client.query("COMMIT");
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Preserve the original error.
    }
    throw error;
  } finally {
    client.release();
  }
}

async function ensureFixture(
  pool: Pool,
  fixture: Fixture,
  password: string,
  signUp: (body: { name: string; email: string; password: string; rememberMe: boolean }) => Promise<unknown>,
) {
  const initial = await readFixtureState(pool, fixture);
  if (initial.state === "complete" && initial.userId && initial.subject) {
    return { label: fixture.label, email: fixture.email, created: false, state: "complete" as const };
  }
  if (initial.state !== "bootstrap-required" || !initial.userId) {
    throw new Error("fixture is not safely bootstrappable");
  }

  const result = await signUp({
    name: initial.displayName,
    email: fixture.email,
    password,
    rememberMe: false,
  });
  const user =
    typeof result === "object" && result !== null && "user" in result &&
    typeof result.user === "object" && result.user !== null && "id" in result.user &&
    typeof result.user.id === "string"
      ? result.user.id.trim()
      : "";
  if (!user) throw new Error("Better Auth did not return a subject");

  let linked = false;
  try {
    await linkSubject(pool, initial.userId, user);
    linked = true;
  } finally {
    if (!linked) {
      await pool.query(`delete from "user" where id = $1 and lower(email) = lower($2)`, [user, fixture.email]);
    }
  }

  const final = await readFixtureState(pool, fixture);
  if (final.state !== "complete") throw new Error("fixture verification failed");
  return { label: fixture.label, email: fixture.email, created: true, state: "complete" as const };
}

async function clearBoundedRateLimits(pool: Pool, request: Request, secret: string) {
  const ip = readTrustedAccessGateClientIp(request);
  const keys = [
    accessGateRateLimitDigest("ip", ip, secret),
    ...FIXTURES.map((fixture) =>
      accessGateRateLimitDigest(
        "contact",
        normalizeAccessIdentifier(fixture.email).contactKey,
        secret,
      ),
    ),
  ];
  let deleted = 0;
  for (const key of keys) {
    const result = await pool.query(`delete from "rateLimit" where "key" = $1`, [key]);
    deleted += result.rowCount ?? 0;
  }
  if (deleted > keys.length) throw new Error("bounded rate-limit reset exceeded key inventory");
  return deleted;
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

  let configuration: ReturnType<typeof assertBootstrapConfiguration>;
  try {
    configuration = assertBootstrapConfiguration(env, target.expectedDatabaseName);
  } catch {
    return fail("configuration");
  }

  const requestUrl = new URL(request.url);
  const origin = request.headers.get("origin");
  const secFetchSite = request.headers.get("sec-fetch-site");
  if (origin !== requestUrl.origin && secFetchSite !== "same-origin") return fail("origin", 403);

  const sha = exactPreviewCommitSha(env);
  if (!sha) return fail("preview-boundary", 404);
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return fail("confirmation", 400);
  }
  if (
    formData.get("confirm") !==
    `BOOTSTRAP_CLIENT_PLAN_AUTH:${target.expectedDatabaseName}:${SCHEMA}:${sha}`
  ) {
    return fail("confirmation", 403);
  }

  const pool = new Pool({
    connectionString: target.databaseUrl,
    connectionTimeoutMillis: 10_000,
    statement_timeout: 30_000,
    max: 3,
  });
  let lockClient: PoolClient | null = null;
  let lockHeld = false;
  let failureStage: FailureStage = "connect";
  try {
    lockClient = await pool.connect();
    failureStage = "lock";
    await lockClient.query("select pg_advisory_lock(hashtext($1))", [ADVISORY_LOCK_KEY]);
    lockHeld = true;

    const identity = await lockClient.query<{ databaseName: string; currentSchema: string | null }>(
      `select current_database() as "databaseName", current_schema() as "currentSchema"`,
    );
    if (
      identity.rows[0]?.databaseName !== target.expectedDatabaseName ||
      identity.rows[0]?.currentSchema !== SCHEMA
    ) {
      throw new Error("staging database identity mismatch");
    }

    const auth = betterAuth({
      appName: "iБюро staging client plan fixtures",
      secret: configuration.auth.secret,
      baseURL: configuration.auth.baseUrl,
      database: pool,
      emailAndPassword: {
        enabled: true,
        disableSignUp: false,
        minPasswordLength: 12,
        maxPasswordLength: 128,
        autoSignIn: false,
      },
      advanced: { database: { joins: true } },
    });
    const signUp = async (body: { name: string; email: string; password: string; rememberMe: boolean }) =>
      auth.api.signUpEmail({ body });

    failureStage = "fixture";
    const fixtures = [];
    for (const fixture of FIXTURES) {
      fixtures.push(await ensureFixture(pool, fixture, configuration.password, signUp));
    }

    failureStage = "verification";
    for (const fixture of FIXTURES) {
      if ((await readFixtureState(pool, fixture)).state !== "complete") {
        throw new Error("post-bootstrap fixture verification failed");
      }
    }
    const rateLimitsDeleted = await clearBoundedRateLimits(pool, request, configuration.auth.secret);

    return safeJson(200, {
      service: "iburo127",
      operation: "staging-client-plan-auth-fixtures",
      environment: "preview",
      branch: VERCEL_STAGING_BRANCH,
      commitSha: sha,
      runtimeTarget: "staging",
      database: target.expectedDatabaseName,
      schema: SCHEMA,
      fixtures,
      rateLimitsDeleted,
      pass: true,
    });
  } catch {
    return fail(failureStage);
  } finally {
    if (lockHeld && lockClient) {
      try {
        await lockClient.query("select pg_advisory_unlock(hashtext($1))", [ADVISORY_LOCK_KEY]);
      } catch {
        // Session teardown releases the lock if explicit unlock fails.
      }
    }
    lockClient?.release();
    await pool.end();
  }
}
