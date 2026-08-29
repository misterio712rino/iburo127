export const STAGING_HTTP_TARGET_GUARD = "STAGING_HTTP_TARGET_GUARD";

type StagingHttpTargetEnv = Readonly<Record<string, string | undefined>>;

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
