import "dotenv/config";

import {
  evaluateStagingAuthFlowGuard,
  generateTotp,
  StagingCookieJar,
} from "./staging-auth-flow-core";

const FAIL = "STAGING_AUTH_FLOW_FAIL";
const MAX_JSON_BYTES = 64 * 1024;

type PlatformRole = "CLIENT" | "LAWYER" | "MANAGER";

type AccountFixture = {
  label: PlatformRole;
  email: string;
  password: string;
  expectedRole: PlatformRole;
  totpSecret?: string;
};

type JsonRecord = Record<string, unknown>;
type PlatformEnvelope = {
  ok?: boolean;
  data?: { roles?: unknown };
  error?: { code?: unknown };
};

class VerificationFailure extends Error {}

function fail(message: string): never {
  throw new VerificationFailure(message);
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) fail(`missing ${name}`);
  return value;
}

function readTimeoutMs(): number {
  const raw = process.env.IB_STAGING_AUTH_REQUEST_TIMEOUT_MS?.trim() || "10000";
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1000 || value > 60000) {
    fail("IB_STAGING_AUTH_REQUEST_TIMEOUT_MS must be an integer from 1000 to 60000");
  }
  return value;
}

function readBaseUrl(): URL {
  let url: URL;
  try {
    url = new URL(required("IB_STAGING_BASE_URL"));
  } catch {
    fail("IB_STAGING_BASE_URL must be a valid URL");
  }

  if (url.username || url.password) fail("IB_STAGING_BASE_URL must not contain credentials");
  if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    fail("IB_STAGING_BASE_URL must use https unless it targets localhost");
  }
  if (url.pathname !== "/" || url.search || url.hash) {
    fail("IB_STAGING_BASE_URL must be an origin without path, query, or fragment");
  }
  return url;
}

function readFixture(
  label: PlatformRole,
  prefix: "CLIENT" | "LAWYER" | "MANAGER",
  requiresTotp: boolean,
): AccountFixture {
  const email = required(`IB_STAGING_${prefix}_EMAIL`);
  const password = required(`IB_STAGING_${prefix}_PASSWORD`);
  if (!email.includes("@")) fail(`${label} fixture email is invalid`);
  if (password.length < 12 || password.length > 128) {
    fail(`${label} fixture password must contain 12 to 128 characters`);
  }

  return {
    label,
    email,
    password,
    expectedRole: label,
    ...(requiresTotp ? { totpSecret: required(`IB_STAGING_${prefix}_TOTP_SECRET`) } : {}),
  };
}

const baseUrl = readBaseUrl();
const timeoutMs = readTimeoutMs();
const guard = evaluateStagingAuthFlowGuard({
  runtimeTarget: process.env.IB_RUNTIME_TARGET,
  authFlowTarget: process.env.IB_STAGING_AUTH_FLOW_TARGET,
  confirmation: process.env.IB_STAGING_AUTH_FLOW_CONFIRM,
  host: baseUrl.host,
});
if (!guard.allowed) fail(`staging-only guard rejected execution (${guard.code})`);

const fixtures: AccountFixture[] = [
  readFixture("CLIENT", "CLIENT", false),
  readFixture("LAWYER", "LAWYER", true),
  readFixture("MANAGER", "MANAGER", true),
];

async function request(
  jar: StagingCookieJar,
  method: "GET" | "POST",
  path: string,
  body?: unknown,
): Promise<Response> {
  const cookie = jar.header();
  let response: Response;
  try {
    response = await fetch(new URL(path, baseUrl), {
      method,
      headers: {
        accept: "application/json",
        origin: baseUrl.origin,
        ...(cookie ? { cookie } : {}),
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
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

async function requirePlatformUnauthenticated(jar: StagingCookieJar, label: string) {
  const response = await request(jar, "GET", "/api/platform/session");
  requirePrivateNoStore(response, label);
  if (response.status !== 401) fail(`${label} expected 401, got ${response.status}`);
  const body = await readJson<PlatformEnvelope>(response);
  if (body.ok !== false || body.error?.code !== "UNAUTHENTICATED") {
    fail(`${label} did not return UNAUTHENTICATED`);
  }
}

async function requirePlatformRole(
  jar: StagingCookieJar,
  label: string,
  expectedRole: PlatformRole,
) {
  const response = await request(jar, "GET", "/api/platform/session");
  requirePrivateNoStore(response, label);
  if (response.status !== 200) fail(`${label} expected 200, got ${response.status}`);
  const body = await readJson<PlatformEnvelope>(response);
  const roles = body.data?.roles;
  if (body.ok !== true || !Array.isArray(roles) || !roles.includes(expectedRole)) {
    fail(`${label} did not expose expected server role`);
  }
}

async function signOut(jar: StagingCookieJar, strict: boolean): Promise<void> {
  if (!jar.hasCookies) return;
  try {
    const response = await request(jar, "POST", "/api/auth/sign-out", {});
    if (strict && response.status !== 200) {
      fail(`session cleanup expected 200, got ${response.status}`);
    }
  } catch (error) {
    if (strict) throw error;
  } finally {
    jar.clear();
  }
}

async function verifyFixture(fixture: AccountFixture): Promise<void> {
  const jar = new StagingCookieJar();
  let completed = false;

  try {
    const signInResponse = await request(jar, "POST", "/api/auth/sign-in/email", {
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
      await requirePlatformRole(jar, "CLIENT authenticated session", fixture.expectedRole);
      await signOut(jar, true);
      completed = true;
      console.log("CLIENT: password sign-in and server role verified");
      return;
    }

    if (!challenged) {
      fail(`${fixture.label} first factor completed without mandatory 2FA challenge`);
    }
    const methods = signIn.twoFactorMethods;
    if (!Array.isArray(methods) || !methods.includes("totp")) {
      fail(`${fixture.label} challenge does not advertise TOTP`);
    }

    await requirePlatformUnauthenticated(
      jar,
      `${fixture.label} pending second-factor session`,
    );

    let code: string;
    try {
      code = generateTotp(fixture.totpSecret);
    } catch {
      fail(`${fixture.label} TOTP fixture secret is invalid`);
    }

    const verifyResponse = await request(jar, "POST", "/api/auth/two-factor/verify-totp", {
      code,
      trustDevice: false,
    });
    if (verifyResponse.status !== 200) {
      fail(`${fixture.label} TOTP verification expected 200, got ${verifyResponse.status}`);
    }
    await readJson<JsonRecord>(verifyResponse);

    await requirePlatformRole(
      jar,
      `${fixture.label} post-MFA session`,
      fixture.expectedRole,
    );
    await signOut(jar, true);
    completed = true;
    console.log(`${fixture.label}: password -> mandatory TOTP -> server role verified`);
  } finally {
    if (!completed) await signOut(jar, false);
  }
}

try {
  await requirePlatformUnauthenticated(new StagingCookieJar(), "anonymous session");
  for (const fixture of fixtures) {
    await verifyFixture(fixture);
  }
  console.log("TRUST_DEVICE: disabled for all TOTP verification requests");
  console.log("STAGING_AUTH_FLOW_PASS");
} catch (error) {
  const message = error instanceof VerificationFailure ? error.message : "unexpected verification failure";
  console.error(`${FAIL}: ${message}`);
  process.exitCode = 1;
}
