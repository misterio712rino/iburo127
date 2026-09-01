import {
  VERCEL_BLOB_STORAGE_PROVIDER,
  YANDEX_OBJECT_STORAGE_PROVIDER,
  readPrivateObjectStorageProvider,
  type PrivateObjectStorageProvider,
} from "@/server/files/object-storage-provider";
import { readVercelBlobAuthConfig, type VercelBlobAuthConfig } from "@/server/files/vercel-blob-config";
import { inferStagingVercelBlobProvider } from "@/server/files/vercel-preview-storage-provider";
import { isValidYandexStorageBucketName } from "@/server/files/yandex-storage-bucket-name";
import { requireStagingHttpTarget } from "./staging-http-target-guard";

export const STAGING_STORAGE_TARGET_GUARD = "STAGING_STORAGE_TARGET_GUARD";

const VERCEL_STAGING_BRANCH = "audit/production-readiness";
const EXACT_GIT_SHA_PATTERN = /^[a-f0-9]{40}$/i;

type Environment = Readonly<Record<string, string | undefined>>;

export type YandexStagingStorageTarget = {
  provider: typeof YANDEX_OBJECT_STORAGE_PROVIDER;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  allowedOrigin: string;
};

export type VercelBlobStagingStorageTarget = {
  provider: typeof VERCEL_BLOB_STORAGE_PROVIDER;
  auth: VercelBlobAuthConfig;
  allowedOrigin: string;
  commitSha: string;
};

export type StagingStorageTarget = YandexStagingStorageTarget | VercelBlobStagingStorageTarget;

function fail(reason: string): never {
  throw new Error(`${STAGING_STORAGE_TARGET_GUARD}:${reason}`);
}

function required(env: Environment, name: string): string {
  const value = env[name]?.trim();
  if (!value) fail(`missing ${name}`);
  return value;
}

function safeCredential(env: Environment, name: string): string {
  const value = required(env, name);
  if (/[\r\n\0]/.test(value)) {
    fail(`${name} contains unsafe control characters`);
  }
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

function effectiveProvider(env: Environment): PrivateObjectStorageProvider {
  const inferred = inferStagingVercelBlobProvider(env);
  if (inferred) return inferred;
  return readPrivateObjectStorageProvider({
    IB_OBJECT_STORAGE_PROVIDER: env.IB_OBJECT_STORAGE_PROVIDER,
  });
}

function assertExactVercelBlobPreview(env: Environment, stagingUrl: URL): VercelBlobStagingStorageTarget {
  if (required(env, "VERCEL_ENV") !== "preview") {
    fail("VERCEL_ENV must equal preview for Vercel Blob staging verification");
  }
  if (required(env, "VERCEL_GIT_COMMIT_REF") !== VERCEL_STAGING_BRANCH) {
    fail(`VERCEL_GIT_COMMIT_REF must equal ${VERCEL_STAGING_BRANCH}`);
  }
  const commitSha = required(env, "VERCEL_GIT_COMMIT_SHA").toLowerCase();
  if (!EXACT_GIT_SHA_PATTERN.test(commitSha)) {
    fail("VERCEL_GIT_COMMIT_SHA must be an exact 40-character Git SHA");
  }

  let auth: VercelBlobAuthConfig;
  try {
    auth = readVercelBlobAuthConfig(env);
  } catch (error) {
    fail(error instanceof Error ? error.message : "invalid Vercel Blob auth configuration");
  }

  return {
    provider: VERCEL_BLOB_STORAGE_PROVIDER,
    auth,
    allowedOrigin: stagingUrl.origin,
    commitSha,
  };
}

function assertYandexTarget(env: Environment, stagingUrl: URL): YandexStagingStorageTarget {
  const bucket = required(env, "YANDEX_STORAGE_BUCKET");
  const expectedBucket = required(env, "IB_STAGING_STORAGE_BUCKET");
  if (!isValidYandexStorageBucketName(bucket)) {
    fail("YANDEX_STORAGE_BUCKET is not a valid Yandex Object Storage bucket name");
  }
  if (!isValidYandexStorageBucketName(expectedBucket)) {
    fail("IB_STAGING_STORAGE_BUCKET is not a valid Yandex Object Storage bucket name");
  }
  if (bucket !== expectedBucket) {
    fail("YANDEX_STORAGE_BUCKET must match IB_STAGING_STORAGE_BUCKET");
  }

  const accessKeyId = safeCredential(env, "YANDEX_STORAGE_ACCESS_KEY_ID");
  const expectedAccessKeyId = safeCredential(env, "IB_STAGING_STORAGE_ACCESS_KEY_ID");
  if (accessKeyId !== expectedAccessKeyId) {
    fail("YANDEX_STORAGE_ACCESS_KEY_ID must match IB_STAGING_STORAGE_ACCESS_KEY_ID");
  }

  const secretAccessKey = safeCredential(env, "YANDEX_STORAGE_SECRET_ACCESS_KEY");
  const allowedOrigin = normalizeAllowedOrigin(required(env, "IB_STAGING_STORAGE_ALLOWED_ORIGIN"));
  if (allowedOrigin !== stagingUrl.origin) {
    fail("IB_STAGING_STORAGE_ALLOWED_ORIGIN must match IB_STAGING_BASE_URL origin");
  }

  return {
    provider: YANDEX_OBJECT_STORAGE_PROVIDER,
    bucket,
    accessKeyId,
    secretAccessKey,
    allowedOrigin,
  };
}

export function assertStagingStorageTarget(
  env: Environment = process.env,
): StagingStorageTarget {
  const stagingUrl = requireStagingHttpTarget(env);
  if (required(env, "IB_STORAGE_TARGET") !== "staging") {
    fail("IB_STORAGE_TARGET must equal staging");
  }

  const provider = effectiveProvider(env);
  if (provider === VERCEL_BLOB_STORAGE_PROVIDER) {
    return assertExactVercelBlobPreview(env, stagingUrl);
  }
  return assertYandexTarget(env, stagingUrl);
}
