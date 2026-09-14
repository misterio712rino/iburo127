export const STAGING_HTTP_TARGET_GUARD = "STAGING_HTTP_TARGET_GUARD";

type StagingHttpTargetEnv = Readonly<Record<string, string | undefined>>;

export type StagingAuthRuntimeTarget = {
  baseUrl: string;
  secret: string;
};

function fail(reason: string): never {
  throw new Error(`${STAGING_HTTP_TARGET_GUARD}:${reason}`);
}

function required(env: StagingHttpTargetEnv, name: string): string {
  const value = env[name]?.trim();
  if (!value) fail(`missing ${name}`);
  return value;
}

function normalizedHostname(url: URL): string {
  return url.hostname.toLowerCase().replace(/\.+$/, "");
}

export function requireStagingHttpTarget(
  env: StagingHttpTargetEnv = process.env,
): URL {
  if (required(env, "IB_RUNTIME_TARGET") !== "staging") {
    fail("IB_RUNTIME_TARGET must equal staging");
  }

  const raw = required(env, "IB_STAGING_BASE_URL");
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    fail("IB_STAGING_BASE_URL is invalid");
  }

  const hostname = normalizedHostname(url);
  const loopback =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]";
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
  if (hostname === "iburo127.ru" || hostname.endsWith(".iburo127.ru")) {
    fail("production hostname is explicitly blocked");
  }

  url.pathname = "/";
  return url;
}

export function requireStagingAuthRuntimeTarget(
  env: StagingHttpTargetEnv = process.env,
): StagingAuthRuntimeTarget {
  const stagingUrl = requireStagingHttpTarget(env);
  const secret = required(env, "BETTER_AUTH_SECRET");
  if (secret.length < 32) {
    fail("BETTER_AUTH_SECRET must be at least 32 characters");
  }

  const rawAuthUrl = required(env, "BETTER_AUTH_URL");
  let authUrl: URL;
  try {
    authUrl = new URL(rawAuthUrl);
  } catch {
    fail("BETTER_AUTH_URL is invalid");
  }
  if (
    authUrl.username ||
    authUrl.password ||
    (authUrl.pathname !== "/" && authUrl.pathname !== "") ||
    authUrl.search ||
    authUrl.hash
  ) {
    fail("BETTER_AUTH_URL must be an origin without credentials/path/query/hash");
  }
  if (authUrl.origin !== stagingUrl.origin) {
    fail("BETTER_AUTH_URL must match IB_STAGING_BASE_URL origin");
  }

  return { baseUrl: authUrl.origin, secret };
}
