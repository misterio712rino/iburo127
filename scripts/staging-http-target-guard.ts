export const STAGING_HTTP_TARGET_GUARD = "STAGING_HTTP_TARGET_GUARD";

function fail(reason: string): never {
  throw new Error(`${STAGING_HTTP_TARGET_GUARD}:${reason}`);
}

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim();
  if (!value) fail(`missing ${name}`);
  return value;
}

export function requireStagingHttpTarget(
  env: NodeJS.ProcessEnv = process.env,
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
