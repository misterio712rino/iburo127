import {
  evaluateStagingAuthFlowGuard,
  generateTotp,
  StagingCookieJar,
} from "./staging-auth-flow-core";

const MAX_JSON_BYTES = 64 * 1024;
export const STAGING_SIGN_IN_LIMITER_WINDOW_WAIT_MS = 11_000;

export type StagingPlatformRole = "CLIENT" | "LAWYER" | "MANAGER";
type StagingSessionFixture = StagingPlatformRole | "OTHER_CLIENT";

export const STAGING_SESSION_COOKIE_ENV_NAMES = [
  "IB_STAGING_CLIENT_COOKIE",
  "IB_STAGING_OTHER_CLIENT_COOKIE",
  "IB_STAGING_LAWYER_COOKIE",
  "IB_STAGING_MANAGER_COOKIE",
] as const;

export type StagingSessionCookies = Readonly<
  Record<StagingPlatformRole, string> & Partial<Record<"OTHER_CLIENT", string>>
>;

type AccountFixture = {
  label: StagingSessionFixture;
  email: string;
  password: string;
  expectedRole: StagingPlatformRole;
  totpSecret?: string;
};

type JsonRecord = Record<string, unknown>;
type AccessGateEnvelope = {
  ok?: boolean;
  data?: {
    state?: unknown;
    challenge?: unknown;
  };
  error?: { code?: unknown };
};
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

export function requiresStagingSignInLimiterWait(
  filesE2e: boolean,
  authenticatedFixtureCount: number,
): boolean {
  return filesE2e && authenticatedFixtureCount === 3;
}

function waitForStagingSignInLimiterWindow(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, STAGING_SIGN_IN_LIMITER_WINDOW_WAIT_MS);
  });
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
  label: StagingSessionFixture,
  prefix: "CLIENT" | "OTHER_CLIENT" | "LAWYER" | "MANAGER",
  expectedRole: StagingPlatformRole,
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
    expectedRole,
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
    const gateResponse = await request(context, jar, "POST", "/api/public/access-gate", {
      identifier: fixture.email,
    });
    requirePrivateNoStore(gateResponse, `${fixture.label} access gate`);
    if (gateResponse.status !== 200) {
      fail(`${fixture.label} access gate expected 200, got ${gateResponse.status}`);
    }
    const gate = await readJson<AccessGateEnvelope>(gateResponse);
    const challenge = gate.data?.challenge;
    if (
      gate.ok !== true ||
      gate.data?.state !== "LOGIN" ||
      typeof challenge !== "string" ||
      challenge.length === 0
    ) {
      fail(`${fixture.label} access gate did not issue an opaque login challenge`);
    }

    const signInResponse = await request(
      context,
      jar,
      "POST",
      "/api/public/access-gate/sign-in",
      {
        challenge,
        password: fixture.password,
      },
    );
    requirePrivateNoStore(signInResponse, `${fixture.label} first factor`);
    if (signInResponse.status !== 200) {
      fail(`${fixture.label} first factor expected 200, got ${signInResponse.status}`);
    }

    const signIn = await readJson<JsonRecord>(signInResponse);
    const challenged = signIn.twoFactorRedirect === true;

    if (!fixture.totpSecret) {
      if (challenged) {
        fail(`${fixture.label} staging fixture unexpectedly requires a second factor`);
      }
      await requirePlatformRole(
        context,
        jar,
        `${fixture.label} authenticated session`,
        fixture.expectedRole,
      );
      if (!jar.hasCookies) fail(`${fixture.label} authenticated session did not issue cookies`);
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

  const filesE2e = env.IB_STAGING_FILES_E2E?.trim() === "1";
  const fixtures: AccountFixture[] = [
    readFixture(env, "CLIENT", "CLIENT", "CLIENT", false),
    readFixture(env, "LAWYER", "LAWYER", "LAWYER", true),
    readFixture(env, "MANAGER", "MANAGER", "MANAGER", true),
    ...(filesE2e
      ? [readFixture(env, "OTHER_CLIENT", "OTHER_CLIENT", "CLIENT", false)]
      : []),
  ];
  const primaryClientFixture = fixtures.find((fixture) => fixture.label === "CLIENT");
  const otherClientFixture = fixtures.find((fixture) => fixture.label === "OTHER_CLIENT");
  if (
    filesE2e &&
    (!primaryClientFixture ||
      !otherClientFixture ||
      primaryClientFixture.email.toLocaleLowerCase("en-US") ===
        otherClientFixture.email.toLocaleLowerCase("en-US"))
  ) {
    fail("OTHER_CLIENT staging fixture must be a dedicated account distinct from CLIENT");
  }
  const jars = new Map<StagingSessionFixture, StagingCookieJar>();

  try {
    for (const fixture of fixtures) {
      if (requiresStagingSignInLimiterWait(filesE2e, jars.size)) {
        onStatus("OTHER_CLIENT: waiting for the documented Better Auth sign-in rate-limit window");
        await waitForStagingSignInLimiterWindow();
      }
      const jar = await authenticateFixture(context, fixture);
      jars.set(fixture.label, jar);
      onStatus(
        fixture.totpSecret
          ? `${fixture.label}: access gate -> password -> mandatory TOTP -> server role verified`
          : `${fixture.label}: access gate -> password sign-in -> server ${fixture.expectedRole} role verified`,
      );
    }
  } catch (error) {
    for (const jar of jars.values()) {
      await revokeSession(context, jar);
    }
    throw error;
  }

  const clientJar = jars.get("CLIENT");
  const otherClientJar = jars.get("OTHER_CLIENT");
  const lawyerJar = jars.get("LAWYER");
  const managerJar = jars.get("MANAGER");
  if (!clientJar || !lawyerJar || !managerJar || (filesE2e && !otherClientJar)) {
    fail("authenticated staging session set is incomplete");
  }

  const cookies: StagingSessionCookies = {
    CLIENT: clientJar.header(),
    LAWYER: lawyerJar.header(),
    MANAGER: managerJar.header(),
    ...(otherClientJar ? { OTHER_CLIENT: otherClientJar.header() } : {}),
  };
  if (!cookies.CLIENT || !cookies.LAWYER || !cookies.MANAGER || (filesE2e && !cookies.OTHER_CLIENT)) {
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
