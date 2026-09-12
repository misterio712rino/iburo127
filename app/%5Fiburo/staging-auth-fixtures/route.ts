import { randomUUID } from "node:crypto";

import { betterAuth } from "better-auth";
import { Pool, type PoolClient } from "pg";
import { requireStagingDatabaseTarget } from "@/scripts/staging-target-guard";
import {
  VERCEL_STAGING_BRANCH,
  isVercelPreviewBackendAllowed,
} from "@/server/config/vercel-preview-boundary";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const AUTH_SCHEMA = "public";
const PROVIDER = "better-auth";
const ADVISORY_LOCK_KEY = "iburo127:staging:auth-fixtures:v1";
const EXACT_GIT_SHA_PATTERN = /^[a-f0-9]{40}$/i;
const PLATFORM_ROLES = new Set(["CLIENT", "LAWYER", "MANAGER"]);

const FIXTURES = [
  {
    label: "CLIENT",
    email: "client.individual@example.test",
    displayName: "Дмитрий Волков",
    role: "CLIENT",
    passwordEnv: "IB_STAGING_CLIENT_PASSWORD",
    allowInternalCreate: false,
  },
  {
    label: "LAWYER",
    email: "lawyer.demo@example.test",
    displayName: "Анна Орлова",
    role: "LAWYER",
    passwordEnv: "IB_STAGING_LAWYER_PASSWORD",
    allowInternalCreate: false,
  },
  {
    label: "MANAGER",
    email: "manager.demo@example.test",
    displayName: "Менеджер iБюро",
    role: "MANAGER",
    passwordEnv: "IB_STAGING_MANAGER_PASSWORD",
    allowInternalCreate: true,
  },
] as const;

type FixtureDefinition = (typeof FIXTURES)[number];
type FixtureLabel = FixtureDefinition["label"];

type DomainUserRow = {
  id: string;
  status: string;
};

type RoleRow = {
  id: string;
  code: string;
};

type AuthUserRow = {
  id: string;
  email: string;
};

type IdentityRow = {
  subject: string;
};

type FixtureState = {
  label: FixtureLabel;
  userId: string | null;
  internalPresent: boolean;
  active: boolean;
  requiredRolePresent: boolean;
  roleExclusive: boolean;
  authPresent: boolean;
  identityLinked: boolean;
  subject: string | null;
  state: "complete" | "bootstrap-required" | "blocked";
};

type BootstrapConfiguration = {
  secret: string;
  baseURL: string;
  passwords: Readonly<Record<FixtureLabel, string>>;
};

type FixtureSignUp = (body: {
  name: string;
  email: string;
  password: string;
  rememberMe: boolean;
}) => Promise<unknown>;

type FailureStage =
  | "preview-boundary"
  | "target"
  | "configuration"
  | "origin"
  | "confirmation"
  | "connect"
  | "lock"
  | "preflight"
  | "fixture-client"
  | "fixture-lawyer"
  | "fixture-manager"
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

function safeJson(status: number, body: Record<string, unknown>) {
  return Response.json(body, { status, headers: NO_STORE_HEADERS });
}

function fail(stage: FailureStage, status = 503) {
  return safeJson(status, {
    service: "iburo127",
    operation: "staging-auth-fixtures",
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

function readSignUpSubject(result: unknown): string | null {
  if (typeof result !== "object" || result === null || !("user" in result)) return null;
  const user = result.user;
  if (typeof user !== "object" || user === null || !("id" in user)) return null;
  const id = user.id;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

function requiredSafePassword(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name] ?? "";
  if (
    value.length < 12 ||
    value.length > 128 ||
    value !== value.trim() ||
    /[\r\n\0]/.test(value)
  ) {
    throw new Error("invalid fixture password");
  }
  return value;
}

function requiredAuthSecret(env: NodeJS.ProcessEnv): string {
  const value = env.BETTER_AUTH_SECRET ?? "";
  if (value.length < 32 || value !== value.trim() || /[\r\n\0]/.test(value)) {
    throw new Error("invalid auth secret");
  }
  return value;
}

function requiredAuthOrigin(env: NodeJS.ProcessEnv): string {
  const raw = env.BETTER_AUTH_URL?.trim();
  if (!raw) throw new Error("missing auth origin");

  const parsed = new URL(raw);
  const hostname = parsed.hostname.toLowerCase().replace(/\.+$/, "");
  const loopback = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
  const secure = parsed.protocol === "https:" || (loopback && parsed.protocol === "http:");
  const originOnly =
    (parsed.pathname === "/" || parsed.pathname === "") &&
    !parsed.search &&
    !parsed.hash &&
    !parsed.username &&
    !parsed.password;

  if (!secure || !originOnly || hostname === "iburo127.ru" || hostname.endsWith(".iburo127.ru")) {
    throw new Error("unsafe auth origin");
  }
  return parsed.origin;
}

function readBootstrapConfiguration(
  env: NodeJS.ProcessEnv,
  databaseName: string,
): BootstrapConfiguration {
  if (env.IB_STAGING_BETTER_AUTH_SCHEMA?.trim() !== AUTH_SCHEMA) {
    throw new Error("invalid Better Auth schema");
  }
  if (
    env.IB_STAGING_AUTH_FIXTURE_BOOTSTRAP_CONFIRM?.trim() !==
    `AUTH-FIXTURES:${databaseName}:${AUTH_SCHEMA}`
  ) {
    throw new Error("fixture bootstrap confirmation mismatch");
  }

  for (const fixture of FIXTURES) {
    const emailName = `IB_STAGING_${fixture.label}_EMAIL`;
    if (env[emailName]?.trim().toLowerCase() !== fixture.email) {
      throw new Error("fixture email mismatch");
    }
  }

  return {
    secret: requiredAuthSecret(env),
    baseURL: requiredAuthOrigin(env),
    passwords: {
      CLIENT: requiredSafePassword(env, "IB_STAGING_CLIENT_PASSWORD"),
      LAWYER: requiredSafePassword(env, "IB_STAGING_LAWYER_PASSWORD"),
      MANAGER: requiredSafePassword(env, "IB_STAGING_MANAGER_PASSWORD"),
    },
  };
}

async function readDomainUser(pool: Pool, email: string): Promise<DomainUserRow | null> {
  const result = await pool.query<DomainUserRow>(
    `select id::text as id, status::text as status from "User" where lower(email) = lower($1) limit 2`,
    [email],
  );
  if (result.rows.length > 1) throw new Error("ambiguous internal fixture email");
  return result.rows[0] ?? null;
}

async function readPlatformRoles(pool: Pool, userId: string): Promise<string[]> {
  const result = await pool.query<{ code: string }>(
    `
      select r.code
      from "UserRole" ur
      join "Role" r on r.id = ur."roleId"
      where ur."userId" = $1::uuid
      order by r.code
    `,
    [userId],
  );
  return result.rows.map((row) => row.code).filter((code) => PLATFORM_ROLES.has(code));
}

async function readAuthUser(pool: Pool, email: string): Promise<AuthUserRow | null> {
  const result = await pool.query<AuthUserRow>(
    `select id, email from "user" where lower(email) = lower($1) limit 2`,
    [email],
  );
  if (result.rows.length > 1) throw new Error("ambiguous Better Auth fixture email");
  return result.rows[0] ?? null;
}

async function readProviderIdentities(pool: Pool, userId: string): Promise<IdentityRow[]> {
  const result = await pool.query<IdentityRow>(
    `select subject from "AuthIdentity" where "userId" = $1::uuid and provider = $2 order by subject`,
    [userId, PROVIDER],
  );
  return result.rows;
}

async function readFixtureState(pool: Pool, fixture: FixtureDefinition): Promise<FixtureState> {
  const user = await readDomainUser(pool, fixture.email);
  const roles = user ? await readPlatformRoles(pool, user.id) : [];
  const authUser = await readAuthUser(pool, fixture.email);
  const identities = user ? await readProviderIdentities(pool, user.id) : [];

  const internalPresent = Boolean(user);
  const active = user?.status === "ACTIVE";
  const requiredRolePresent = roles.includes(fixture.role);
  const roleExclusive = roles.length === 1 && roles[0] === fixture.role;
  const authPresent = Boolean(authUser);
  const identityLinked =
    Boolean(user && authUser) &&
    identities.length === 1 &&
    identities[0]?.subject === authUser?.id;

  const internalReady = active && requiredRolePresent && roleExclusive;
  const complete = internalReady && authPresent && identityLinked;
  const cleanAuthBaseline = !authPresent && identities.length === 0;
  const bootstrapRequired =
    cleanAuthBaseline &&
    (internalReady || (!internalPresent && fixture.allowInternalCreate));

  return {
    label: fixture.label,
    userId: user?.id ?? null,
    internalPresent,
    active,
    requiredRolePresent,
    roleExclusive,
    authPresent,
    identityLinked,
    subject: complete ? authUser?.id ?? null : null,
    state: complete ? "complete" : bootstrapRequired ? "bootstrap-required" : "blocked",
  };
}

async function readFixtureStates(pool: Pool): Promise<FixtureState[]> {
  const states: FixtureState[] = [];
  for (const fixture of FIXTURES) states.push(await readFixtureState(pool, fixture));
  return states;
}

async function readPreflight(
  databaseUrl: string,
  expectedDatabaseName: string,
): Promise<{ identityPass: boolean; states: FixtureState[] }> {
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
    const identity = await client.query<{ database_name: string; current_schema: string | null }>(
      "select current_database() as database_name, current_schema() as current_schema",
    );
    const row = identity.rows[0];
    await client.query("ROLLBACK");
    client.release();
    client = null;

    const states = await readFixtureStates(pool);
    return {
      identityPass:
        row?.database_name === expectedDatabaseName && row.current_schema === AUTH_SCHEMA,
      states,
    };
  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // Preserve the original read-only failure.
      }
    }
    throw error;
  } finally {
    client?.release();
    await pool.end();
  }
}

async function createManagerInternalUser(pool: Pool, fixture: FixtureDefinition): Promise<string> {
  if (!fixture.allowInternalCreate) throw new Error("internal fixture creation is not allowed");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query<DomainUserRow>(
      `select id::text as id, status::text as status from "User" where lower(email) = lower($1) limit 2`,
      [fixture.email],
    );
    if (existing.rows.length !== 0) throw new Error("manager internal fixture appeared concurrently");

    const role = await client.query<RoleRow>(
      `select id::text as id, code from "Role" where code = $1 limit 2`,
      [fixture.role],
    );
    if (role.rows.length !== 1 || role.rows[0]?.code !== fixture.role) {
      throw new Error("required manager role is missing");
    }

    const userId = randomUUID();
    await client.query(
      `
        insert into "User" (id, email, "displayName", status, "createdAt", "updatedAt")
        values ($1::uuid, $2, $3, 'ACTIVE', now(), now())
      `,
      [userId, fixture.email, fixture.displayName],
    );
    await client.query(
      `insert into "UserRole" ("userId", "roleId", "assignedAt") values ($1::uuid, $2::uuid, now())`,
      [userId, role.rows[0]!.id],
    );
    await client.query("COMMIT");
    return userId;
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
}

async function linkNewAuthSubject(
  pool: Pool,
  userId: string,
  subject: string,
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const locked = await client.query<{ id: string; status: string }>(
      `select id::text as id, status::text as status from "User" where id = $1::uuid for update`,
      [userId],
    );
    if (locked.rows[0]?.status !== "ACTIVE") throw new Error("fixture user is no longer ACTIVE");

    const ownIdentity = await client.query<IdentityRow>(
      `select subject from "AuthIdentity" where "userId" = $1::uuid and provider = $2`,
      [userId, PROVIDER],
    );
    if (ownIdentity.rows.length !== 0) throw new Error("fixture acquired an identity concurrently");

    const claimed = await client.query<{ userId: string }>(
      `select "userId"::text as "userId" from "AuthIdentity" where provider = $1 and subject = $2`,
      [PROVIDER, subject],
    );
    if (claimed.rows.length !== 0) throw new Error("new Better Auth subject is already linked");

    await client.query(
      `
        insert into "AuthIdentity" (id, "userId", provider, subject, "createdAt", "updatedAt")
        values ($1::uuid, $2::uuid, $3, $4, now(), now())
      `,
      [randomUUID(), userId, PROVIDER, subject],
    );
    await client.query("COMMIT");
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
}

async function bootstrapFixture(
  pool: Pool,
  signUpFixture: FixtureSignUp,
  fixture: FixtureDefinition,
  password: string,
): Promise<{ label: FixtureLabel; email: string; userId: string; subject: string; internalCreated: boolean; authCreated: boolean }> {
  let state = await readFixtureState(pool, fixture);
  if (state.state === "complete" && state.userId && state.subject) {
    return {
      label: fixture.label,
      email: fixture.email,
      userId: state.userId,
      subject: state.subject,
      internalCreated: false,
      authCreated: false,
    };
  }
  if (state.state !== "bootstrap-required") throw new Error("fixture is not safely bootstrappable");

  let internalCreated = false;
  if (!state.userId) {
    await createManagerInternalUser(pool, fixture);
    internalCreated = true;
    state = await readFixtureState(pool, fixture);
    if (state.state !== "bootstrap-required" || !state.userId) {
      throw new Error("new internal fixture did not reach a clean auth baseline");
    }
  }

  const userId = state.userId;
  const signUp = await signUpFixture({
    name: fixture.displayName,
    email: fixture.email,
    password,
    rememberMe: false,
  });
  const subject = readSignUpSubject(signUp);
  if (!subject) throw new Error("Better Auth did not return a fixture subject");

  let linked = false;
  try {
    const persisted = await readAuthUser(pool, fixture.email);
    if (!persisted || persisted.id !== subject) {
      throw new Error("persisted Better Auth fixture does not match signup result");
    }
    await linkNewAuthSubject(pool, userId, subject);
    linked = true;
  } finally {
    if (!linked) {
      await pool.query(
        `delete from "user" where id = $1 and lower(email) = lower($2)`,
        [subject, fixture.email],
      );
    }
  }

  return {
    label: fixture.label,
    email: fixture.email,
    userId,
    subject,
    internalCreated,
    authCreated: true,
  };
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

  let configurationReady = false;
  try {
    readBootstrapConfiguration(env, target.expectedDatabaseName);
    configurationReady = true;
  } catch {
    configurationReady = false;
  }

  let preflight: Awaited<ReturnType<typeof readPreflight>>;
  try {
    preflight = await readPreflight(target.databaseUrl, target.expectedDatabaseName);
  } catch {
    return fail("connect");
  }

  const sha = exactPreviewCommitSha(env);
  const statesSafe = preflight.states.map((state) => ({
    label: state.label,
    internalPresent: state.internalPresent,
    active: state.active,
    requiredRolePresent: state.requiredRolePresent,
    roleExclusive: state.roleExclusive,
    betterAuthPresent: state.authPresent,
    identityLinked: state.identityLinked,
    state: state.state,
  }));
  const safeToBootstrap =
    Boolean(sha) &&
    configurationReady &&
    preflight.identityPass &&
    preflight.states.every((state) => state.state !== "blocked");
  const requestConfirmation = sha
    ? `BOOTSTRAP_AUTH_FIXTURES:${target.expectedDatabaseName}:${AUTH_SCHEMA}:${sha}`
    : "";
  const form = safeToBootstrap
    ? `<form method="post"><input type="hidden" name="confirm" value="${htmlEscape(requestConfirmation)}"><button type="submit">Bootstrap guarded staging auth fixtures</button></form>`
    : "";

  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><title>iБюро staging auth fixtures</title></head><body><main><h1>iБюро staging auth fixtures</h1><p>${safeToBootstrap ? "All guarded preconditions passed. POST bootstrap is enabled." : "Bootstrap is blocked because one or more guarded preconditions failed."}</p><ul><li>environment: preview</li><li>branch: ${htmlEscape(VERCEL_STAGING_BRANCH)}</li><li>commit: ${htmlEscape(sha ?? "unavailable")}</li><li>database: ${htmlEscape(target.expectedDatabaseName)}</li><li>schema: ${AUTH_SCHEMA}</li><li>configuration ready: ${String(configurationReady)}</li><li>database identity pass: ${String(preflight.identityPass)}</li></ul><pre>${htmlEscape(JSON.stringify(statesSafe, null, 2))}</pre>${form}</main></body></html>`,
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

  let configuration: BootstrapConfiguration;
  try {
    configuration = readBootstrapConfiguration(env, target.expectedDatabaseName);
  } catch {
    return fail("configuration");
  }

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
  const expectedRequestConfirmation =
    `BOOTSTRAP_AUTH_FIXTURES:${target.expectedDatabaseName}:${AUTH_SCHEMA}:${sha}`;
  if (formData.get("confirm") !== expectedRequestConfirmation) {
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

    failureStage = "preflight";
    const identity = await lockClient.query<{ database_name: string; current_schema: string | null }>(
      "select current_database() as database_name, current_schema() as current_schema",
    );
    const identityRow = identity.rows[0];
    if (
      identityRow?.database_name !== target.expectedDatabaseName ||
      identityRow.current_schema !== AUTH_SCHEMA
    ) {
      throw new Error("staging database identity mismatch");
    }
    const initialStates = await readFixtureStates(pool);
    if (initialStates.some((state) => state.state === "blocked")) {
      throw new Error("fixture preflight contains a blocked state");
    }

    const auth = betterAuth({
      appName: "iБюро staging fixtures",
      secret: configuration.secret,
      baseURL: configuration.baseURL,
      database: pool,
      emailAndPassword: {
        enabled: true,
        disableSignUp: false,
        minPasswordLength: 12,
        maxPasswordLength: 128,
        autoSignIn: false,
      },
      advanced: {
        database: {
          joins: true,
        },
      },
    });
    const signUpFixture: FixtureSignUp = async (body) => auth.api.signUpEmail({ body });

    const results: Array<Awaited<ReturnType<typeof bootstrapFixture>>> = [];
    for (const fixture of FIXTURES) {
      failureStage =
        fixture.label === "CLIENT"
          ? "fixture-client"
          : fixture.label === "LAWYER"
            ? "fixture-lawyer"
            : "fixture-manager";
      results.push(
        await bootstrapFixture(
          pool,
          signUpFixture,
          fixture,
          configuration.passwords[fixture.label],
        ),
      );
    }

    failureStage = "verification";
    const finalStates = await readFixtureStates(pool);
    if (finalStates.some((state) => state.state !== "complete")) {
      throw new Error("fixture post-bootstrap verification failed");
    }

    return safeJson(200, {
      service: "iburo127",
      operation: "staging-auth-fixtures",
      environment: "preview",
      branch: VERCEL_STAGING_BRANCH,
      commitSha: sha,
      runtimeTarget: "staging",
      database: target.expectedDatabaseName,
      schema: AUTH_SCHEMA,
      fixtures: results,
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
    await pool.end();
  }
}
