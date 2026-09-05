import {
  evaluateStagingAuthFlowGuard,
  StagingCookieJar,
} from "./staging-auth-flow-core";

const FAIL = "STAGING_CLIENT_PLAN_LOGIN_MATRIX_FAIL";
const MAX_JSON_BYTES = 64 * 1024;
const FIXTURES = ["client.lite@example.test", "client.pro@example.test"] as const;

type Envelope = Record<string, unknown> & {
  ok?: boolean;
  data?: { state?: unknown; challenge?: unknown; roles?: unknown };
  error?: { code?: unknown };
};

function fail(message: string): never {
  throw new Error(`${FAIL}: ${message}`);
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) fail(`missing ${name}`);
  return value;
}

function readBaseUrl(): URL {
  let url: URL;
  try {
    url = new URL(required("IB_STAGING_BASE_URL"));
  } catch {
    fail("IB_STAGING_BASE_URL must be a valid URL");
  }
  const loopback = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !(loopback && url.protocol === "http:")) {
    fail("staging base URL must use HTTPS unless loopback");
  }
  if (url.username || url.password || (url.pathname !== "/" && url.pathname !== "") || url.search || url.hash) {
    fail("staging base URL must be an origin");
  }
  const hostname = url.hostname.toLowerCase().replace(/\.+$/, "");
  if (hostname === "iburo127.ru" || hostname.endsWith(".iburo127.ru")) {
    fail("production hostname is explicitly blocked");
  }
  return url;
}

async function readJson(response: Response): Promise<Envelope> {
  const text = await response.text();
  if (Buffer.byteLength(text, "utf8") > MAX_JSON_BYTES) fail("response exceeded JSON size limit");
  try {
    return JSON.parse(text) as Envelope;
  } catch {
    fail(`malformed JSON response with status ${response.status}`);
  }
}

function requireNoStore(response: Response, label: string) {
  if (!(response.headers.get("cache-control")?.toLowerCase().includes("no-store") ?? false)) {
    fail(`${label} response is missing no-store policy`);
  }
}

async function request(
  baseUrl: URL,
  jar: StagingCookieJar,
  method: "GET" | "POST",
  path: string,
  body?: unknown,
) {
  const response = await fetch(new URL(path, baseUrl), {
    method,
    headers: {
      accept: "application/json",
      origin: baseUrl.origin,
      ...(jar.header() ? { cookie: jar.header() } : {}),
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
    signal: AbortSignal.timeout(15_000),
  });
  jar.absorb(response.headers);
  return response;
}

async function verifyFixture(baseUrl: URL, email: string, password: string) {
  const jar = new StagingCookieJar();
  try {
    const gateResponse = await request(baseUrl, jar, "POST", "/api/public/access-gate", { identifier: email });
    requireNoStore(gateResponse, "access gate");
    if (gateResponse.status !== 200) fail(`client access gate expected 200, got ${gateResponse.status}`);
    const gate = await readJson(gateResponse);
    const challenge = gate.data?.challenge;
    if (gate.ok !== true || gate.data?.state !== "LOGIN" || typeof challenge !== "string" || !challenge) {
      fail("client access gate did not return LOGIN challenge");
    }

    const signInResponse = await request(baseUrl, jar, "POST", "/api/public/access-gate/sign-in", {
      challenge,
      password,
    });
    requireNoStore(signInResponse, "client sign-in");
    if (signInResponse.status !== 200) fail(`client sign-in expected 200, got ${signInResponse.status}`);
    const signIn = await readJson(signInResponse);
    if (signIn.twoFactorRedirect === true) fail("client fixture unexpectedly requires MFA");

    const sessionResponse = await request(baseUrl, jar, "GET", "/api/platform/session");
    requireNoStore(sessionResponse, "client session");
    if (sessionResponse.status !== 200) fail(`client session expected 200, got ${sessionResponse.status}`);
    const session = await readJson(sessionResponse);
    const roles = session.data?.roles;
    if (session.ok !== true || !Array.isArray(roles) || !roles.includes("CLIENT")) {
      fail("authenticated fixture did not expose CLIENT role");
    }
    if (!jar.hasCookies) fail("authenticated fixture did not issue cookies");
  } finally {
    if (jar.hasCookies) {
      try {
        await request(baseUrl, jar, "POST", "/api/auth/sign-out", {});
      } finally {
        jar.clear();
      }
    }
  }
}

try {
  const baseUrl = readBaseUrl();
  const guard = evaluateStagingAuthFlowGuard({
    runtimeTarget: process.env.IB_RUNTIME_TARGET,
    authFlowTarget: process.env.IB_STAGING_AUTH_FLOW_TARGET,
    confirmation: process.env.IB_STAGING_AUTH_FLOW_CONFIRM,
    host: baseUrl.host,
  });
  if (!guard.allowed) fail(`staging auth guard rejected execution (${guard.code})`);

  const password = required("IB_STAGING_CLIENT_PASSWORD");
  if (password.length < 12 || password.length > 128 || /[\r\n\0]/.test(password)) {
    fail("staging client password is invalid");
  }

  for (const email of FIXTURES) await verifyFixture(baseUrl, email, password);
  console.log("STAGING_CLIENT_PLAN_LOGIN_MATRIX_PASS");
} catch (error) {
  console.error(error instanceof Error ? error.message : `${FAIL}: unexpected failure`);
  process.exitCode = 1;
}
