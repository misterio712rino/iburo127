import { requireStagingHttpTarget } from "./staging-http-target-guard";

export const STAGING_STORAGE_TARGET_GUARD = "STAGING_STORAGE_TARGET_GUARD";

type Environment = Readonly<Record<string, string | undefined>>;

export type StagingStorageTarget = {
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  allowedOrigin: string;
};

function fail(reason: string): never {
  throw new Error(`${STAGING_STORAGE_TARGET_GUARD}:${reason}`);
}

function required(env: Environment, name: string): string {
  const value = env[name]?.trim();
  if (!value) fail(`missing ${name}`);
  return value;
}

function normalizeAllowedOrigin(value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    fail("IB_STAGING_STORAGE_ALLOWED_ORIGIN is invalid");
  }

  const hostname = parsed.hostname.toLowerCase().replace(/\.+$/, "");
  const loopback =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]";
  const protocolAllowed =
    parsed.protocol === "https:" || (loopback && parsed.protocol === "http:");
  const originOnly =
    (parsed.pathname === "/" || parsed.pathname === "") &&
    !parsed.search &&
    !parsed.hash &&
    !parsed.username &&
    !parsed.password;
  if (!protocolAllowed || !originOnly) {
    fail("IB_STAGING_STORAGE_ALLOWED_ORIGIN must be a secure origin without path/query/credentials");
  }
  if (hostname === "iburo127.ru" || hostname.endsWith(".iburo127.ru")) {
    fail("production storage CORS origin is explicitly blocked");
  }
  return parsed.origin;
}

export function assertStagingStorageTarget(
  env: Environment = process.env,
): StagingStorageTarget {
  const stagingUrl = requireStagingHttpTarget(env);
  if (required(env, "IB_STORAGE_TARGET") !== "staging") {
    fail("IB_STORAGE_TARGET must equal staging");
  }

  const bucket = required(env, "YANDEX_STORAGE_BUCKET");
  const expectedBucket = required(env, "IB_STAGING_STORAGE_BUCKET");
  if (bucket !== expectedBucket) {
    fail("YANDEX_STORAGE_BUCKET must match IB_STAGING_STORAGE_BUCKET");
  }

  const accessKeyId = required(env, "YANDEX_STORAGE_ACCESS_KEY_ID");
  const expectedAccessKeyId = required(env, "IB_STAGING_STORAGE_ACCESS_KEY_ID");
  if (accessKeyId !== expectedAccessKeyId) {
    fail("YANDEX_STORAGE_ACCESS_KEY_ID must match IB_STAGING_STORAGE_ACCESS_KEY_ID");
  }

  const allowedOrigin = normalizeAllowedOrigin(required(env, "IB_STAGING_STORAGE_ALLOWED_ORIGIN"));
  if (allowedOrigin !== stagingUrl.origin) {
    fail("IB_STAGING_STORAGE_ALLOWED_ORIGIN must match IB_STAGING_BASE_URL origin");
  }

  return {
    bucket,
    accessKeyId,
    secretAccessKey: required(env, "YANDEX_STORAGE_SECRET_ACCESS_KEY"),
    allowedOrigin,
  };
}
