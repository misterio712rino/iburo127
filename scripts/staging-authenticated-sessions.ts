import {
  evaluateStagingAuthFlowGuard,
  generateTotp,
  StagingCookieJar,
} from "./staging-auth-flow-core";

const MAX_JSON_BYTES = 64 * 1024;

export type StagingPlatformRole = "CLIENT" | "LAWYER" | "MANAGER";

export const STAGING_SESSION_COOKIE_ENV_NAMES = [
  "IB_STAGING_CLIENT_COOKIE",
  "IB_STAGING_LAWYER_COOKIE",
  "IB_STAGING_MANAGER_COOKIE",
] as const;

export type StagingSessionCookies = Readonly<
  Record<StagingPlatformRole, string>
>;

type AccountFixture = {
  label: StagingPlatformRole;
  email: string;
  password: string;
  expectedRole: StagingPlatformRole;
  totpSecret?: string;
};

type JsonRecord = Record<string, unknown>;
type PlatformEnvelope = {
  ok?: boolean;
  data?: { roles?: unknown };
  error?: { code?: unknown };
};

type RequestContext = {
  baseUrl: URL;
  timeoutMs: number;
};

export class StagingAuthSessionFailure extends Error {}

function fail(message: string): never {
  throw new StagingAuthSessionFailure(message);
}

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim();
  if (!value) fail(`missing ${name}`);
  return value;
}

function readTimeoutMs(env: NodeJS.ProcessEnv): number {
  const raw = env.IB_STAGING_AUTH_REQUEST_TIMEOUT_MS?.trim() || "10000";
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1000 || value > 60000) {
    fail("IB_STAGING_AUTH_REQUEST_TIMEOUT_MS must be an integer from 1000 to 60000");
  }
  return value;
}

function readBaseUrl(env: NodeJS.ProcessEnv): URL {
  let url: URL;
  try {
    url = new URL(required(env, "IB_STAGING_BASE_URL"));
  } catch {
    fail("IB_STAGING_BASE_URL must be a valid URL");
  }

  const loopback =
    url.hostname === "localhost" ||
    url.hostname === "127.0.0.1" ||
    url.hostname === "[::1]";
  if (url.protocol !== "https:" && !(loopback && url.protocol === "http:")) {
    fail("IB_STAGING_BASE_URL must use https unless it targets loopback");
  }
  if (
    url.username ||
    url.password ||
    (url.pathname !== "/" && url.pathname !== "") ||
    url.search ||
    url.hash
  ) {
    fail("IB_STAGING_BASE_URL must be an origin without credentials/path/query/hash");
  }
  if (url.hostname === "iburo127.ru" || url.hostname === "www.iburo127.ru") {
    fail("production hostname is explicitly blocked");
  }
  url.pathname = "/";
  return url;
}

function readFixture(
  env: NodeJS.ProcessEnv,
  label: StagingPlatformRole,
  prefix: "CLIENT" | "LAWYER" | "MANAGER",
  requiresTotp: boolean,
): AccountFixture {
  const email = required(env, `IB_STAGING_${prefix}_EMAIL`);
  const password = required(env, `IB_STAGING_${prefix}_PASSWORD`);
  if (!email.includes("@")) fail(`${label} fixture email is invalid`);
  if (password.length < 12 || password.length > 128) {
    fail(`${label} fixture password must contain 12 to 128 characters`);
  }

  return {
    label,
    email,
    password,
    expectedRole: label,
    ...(requiresTotp
      ? { totpSecret: required(env, `IB_STAGING_${prefix}_TOTP_SECRET`) }
      : {}),
  };
}

async function request(
  context: RequestContext,
  jar: StagingCookieJar,
  method: "GET" | "POST",
  path: string,
  body?: unknown,
): Promise<Response> {
  const cookie = jar.header();
  let response: Response;
  try {
    response = await fetch(new URL(path, context.baseUrl), {
      method,
      headers: {
        accept: "application/json",
        origin: context.baseUrl.origin,
        ...(cookie ? { cookie } : {}),
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: "manual",
      signal: AbortSignal.timeout(context.timeoutMs),
    });
  } catch {
    fail("network request failed or timed out");
  }

  try {
    jar.absorb(response.headers);
  } catch {
    fail("runtime cannot read Set-Cookie headers safely");
  }
  return response;
}

async function readJson<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json")) {
    fail(`expected JSON response, got status ${response.status}`);
  }

  const contentLength = Number(response.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_JSON_BYTES) {
    fail("JSON response exceeded size limit");
  }

  const text = await response.text();
  if (Buffer.byteLength(text, "utf8") > MAX_JSON_BYTES) {
    fail("JSON response exceeded size limit");
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    fail(`malformed JSON response with status ${response.status}`);
  }
}

function requirePrivateNoStore(response: Response, label: string): void {
  const cacheControl = response.headers.get("cache-control")?.toLowerCase() ?? "";
  if (!cacheControl.includes("no-store")) {
    fail(`${label} response is missing no-store cache policy`);
  }
}

async function requirePlatformUnauthenticated(
  context: RequestContext,
  jar: StagingCookieJar,
  label: string,
): Promise<void> {
  const response = await request(context, jar, "GET", "/api/platform/session");
  requirePrivateNoStore(response, label);
  if (response.status !== 401) fail(`${label} expected 401, got ${response.status}`);
  const body = await readJson<PlatformEnvelope>(response);
  if (body.ok !== false || body.error?.code !== "UNAUTHENTICATED") {
    fail(`${label} did not return UNAUTHENTICATED`);
  }
}

async function requirePlatformRole(
  context: RequestContext,
  jar: StagingCookieJar,
  label: string,
  expectedRole: StagingPlatformRole,
): Promise<void> {
  const response = await request(context, jar, "GET", "/api/platform/session");
  requirePrivateNoStore(response, label);
  if (response.status !== 200) fail(`${label} expected 200, got ${response.status}`);
  const body = await readJson<PlatformEnvelope>(response);
  const roles = body.data?.roles;
  if (body.ok !== true || !Array.isArray(roles) || !roles.includes(expectedRole)) {
    fail(`${label} did not expose expected server role`);
  }
}

async function revokeSession(
  context: RequestContext,
  jar: StagingCookieJar,
): Promise<boolean> {
  if (!jar.hasCookies) return true;
  let success = false;
  try {
    const response = await request(context, jar, "POST", "/api/auth/sign-out", {});
    success = response.status === 200;
  } catch {
    success = false;
  } finally {
    jar.clear();
  }
  return success;
}

async function authenticateFixture(
  context: RequestContext,
  fixture: AccountFixture,
): Promise<StagingCookieJar> {
  const jar = new StagingCookieJar();
  try {
    const signInResponse = await request(context, jar, "POST", "/api/auth/sign-in/email", {
      email: fixture.email,
      password: fixture.password,
    });
    if (signInResponse.status !== 200) {
      fail(`${fixture.label} first factor expected 200, got ${signInResponse.status}`);
    }

    const signIn = await readJson<JsonRecord>(signInResponse);
    const challenged = signIn.twoFactorRedirect === true;

    if (!fixture.totpSecret) {
      if (challenged) {
        fail("CLIENT staging fixture unexpectedly requires a second factor");
      }
      await requirePlatformRole(
        context,
        jar,
        "CLIENT authenticated session",
        fixture.expectedRole,
      );
      if (!jar.hasCookies) fail("CLIENT authenticated session did not issue cookies");
      return jar;
    }

    if (!challenged) {
      fail(`${fixture.label} first factor completed without mandatory 2FA challenge`);
    }
    const methods = signIn.twoFactorMethods;
    if (!Array.isArray(methods) || !methods.includes("totp")) {
      fail(`${fixture.label} challenge does not advertise TOTP`);
    }

    await requirePlatformUnauthenticated(
      context,
      jar,
      `${fixture.label} pending second-factor session`,
    );

    let code: string;
    try {
      code = generateTotp(fixture.totpSecret);
    } catch {
      fail(`${fixture.label} TOTP fixture secret is invalid`);
    }

    const verifyResponse = await request(
      context,
      jar,
      "POST",
      "/api/auth/two-factor/verify-totp",
      { code, trustDevice: false },
    );
    if (verifyResponse.status !== 200) {
      fail(`${fixture.label} TOTP verification expected 200, got ${verifyResponse.status}`);
    }
    await readJson<JsonRecord>(verifyResponse);
    await requirePlatformRole(
      context,
      jar,
      `${fixture.label} post-MFA session`,
      fixture.expectedRole,
    );
    if (!jar.hasCookies) fail(`${fixture.label} authenticated session did not issue cookies`);
    return jar;
  } catch (error) {
    await revokeSession(context, jar);
    throw error;
  }
}

export type StagingAuthenticatedSessions = {
  baseUrl: string;
  cookies: StagingSessionCookies;
  cleanup(options?: { strict?: boolean }): Promise<void>;
};

export async function createStagingAuthenticatedSessions(options: {
  env?: NodeJS.ProcessEnv;
  onStatus?: (message: string) => void;
} = {}): Promise<StagingAuthenticatedSessions> {
  const env = options.env ?? process.env;
  const onStatus = options.onStatus ?? (() => undefined);
  const baseUrl = readBaseUrl(env);
  const context: RequestContext = {
    baseUrl,
    timeoutMs: readTimeoutMs(env),
  };
  const guard = evaluateStagingAuthFlowGuard({
    runtimeTarget: env.IB_RUNTIME_TARGET,
    authFlowTarget: env.IB_STAGING_AUTH_FLOW_TARGET,
    confirmation: env.IB_STAGING_AUTH_FLOW_CONFIRM,
    host: baseUrl.host,
  });
  if (!guard.allowed) {
    fail(`staging-only guard rejected execution (${guard.code})`);
  }

  await requirePlatformUnauthenticated(
    context,
    new StagingCookieJar(),
    "anonymous session",
  );
  onStatus("UNAUTHENTICATED: session endpoint correctly denied");

  const fixtures: AccountFixture[] = [
    readFixture(env, "CLIENT", "CLIENT", false),
    readFixture(env, "LAWYER", "LAWYER", true),
    readFixture(env, "MANAGER", "MANAGER", true),
  ];
  const jars = new Map<StagingPlatformRole, StagingCookieJar>();

  try {
    for (const fixture of fixtures) {
      const jar = await authenticateFixture(context, fixture);
      jars.set(fixture.label, jar);
      onStatus(
        fixture.totpSecret
          ? `${fixture.label}: password -> mandatory TOTP -> server role verified`
          : "CLIENT: password sign-in and server role verified",
      );
    }
  } catch (error) {
    for (const jar of jars.values()) {
      await revokeSession(context, jar);
    }
    throw error;
  }

  const clientJar = jars.get("CLIENT");
  const lawyerJar = jars.get("LAWYER");
  const managerJar = jars.get("MANAGER");
  if (!clientJar || !lawyerJar || !managerJar) {
    fail("authenticated staging session set is incomplete");
  }

  const cookies: StagingSessionCookies = {
    CLIENT: clientJar.header(),
    LAWYER: lawyerJar.header(),
    MANAGER: managerJar.header(),
  };
  if (!cookies.CLIENT || !cookies.LAWYER || !cookies.MANAGER) {
    fail("authenticated staging session cookies are incomplete");
  }

  let cleaned = false;
  return {
    baseUrl: baseUrl.origin,
    cookies,
    async cleanup({ strict = false } = {}) {
      if (cleaned) return;
      cleaned = true;
      let cleanupFailed = false;
      for (const jar of jars.values()) {
        const revoked = await revokeSession(context, jar);
        if (!revoked) cleanupFailed = true;
      }
      if (strict && cleanupFailed) {
        fail("one or more staging sessions could not be revoked cleanly");
      }
    },
  };
}
