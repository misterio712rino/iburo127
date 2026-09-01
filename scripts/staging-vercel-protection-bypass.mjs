const ENABLE_ENV = "IB_STAGING_VERCEL_AUTOMATION_BYPASS";
const SECRET_ENV = "VERCEL_AUTOMATION_BYPASS_SECRET";
const BASE_URL_ENV = "IB_STAGING_BASE_URL";

function fail(message) {
  throw new Error(`STAGING_VERCEL_AUTOMATION_BYPASS_FAIL:${message}`);
}

function readTargetOrigin(env) {
  if (env.IB_RUNTIME_TARGET?.trim() !== "staging") {
    fail("IB_RUNTIME_TARGET must equal staging");
  }

  const raw = env[BASE_URL_ENV]?.trim();
  if (!raw) fail(`missing ${BASE_URL_ENV}`);

  let url;
  try {
    url = new URL(raw);
  } catch {
    fail(`${BASE_URL_ENV} must be a valid URL`);
  }

  const loopback =
    url.hostname === "localhost" ||
    url.hostname === "127.0.0.1" ||
    url.hostname === "[::1]";
  if (url.protocol !== "https:" && !(loopback && url.protocol === "http:")) {
    fail(`${BASE_URL_ENV} must use https unless it targets loopback`);
  }
  if (
    url.username ||
    url.password ||
    (url.pathname !== "/" && url.pathname !== "") ||
    url.search ||
    url.hash
  ) {
    fail(`${BASE_URL_ENV} must be an origin without credentials/path/query/hash`);
  }

  const hostname = url.hostname.toLowerCase().replace(/\.+$/, "");
  if (hostname === "iburo127.ru" || hostname.endsWith(".iburo127.ru")) {
    fail("production hostname is explicitly blocked");
  }

  return url.origin;
}

function readSecret(env) {
  const secret = env[SECRET_ENV];
  if (!secret) fail(`missing ${SECRET_ENV}`);
  if (secret !== secret.trim() || secret.length < 16 || /[\r\n\0]/.test(secret)) {
    fail(`${SECRET_ENV} must be a safe non-empty automation secret`);
  }
  return secret;
}

if (process.env[ENABLE_ENV]?.trim() === "1") {
  if (typeof globalThis.fetch !== "function") {
    fail("global fetch is unavailable");
  }

  const targetOrigin = readTargetOrigin(process.env);
  const secret = readSecret(process.env);
  const nativeFetch = globalThis.fetch.bind(globalThis);

  globalThis.fetch = async (input, init) => {
    const inputUrl =
      input instanceof Request
        ? input.url
        : input instanceof URL
          ? input.href
          : String(input);
    const requestUrl = new URL(inputUrl, targetOrigin);

    if (requestUrl.origin !== targetOrigin) {
      return nativeFetch(input, init);
    }

    const request =
      input instanceof Request
        ? new Request(input, init)
        : new Request(requestUrl, init);
    const headers = new Headers(request.headers);
    headers.set("x-vercel-protection-bypass", secret);

    return nativeFetch(new Request(request, { headers }));
  };
}
