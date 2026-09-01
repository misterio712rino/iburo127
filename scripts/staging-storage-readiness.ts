import { VERCEL_STAGING_BRANCH } from "@/server/config/vercel-preview-boundary";
import {
  VERCEL_BLOB_STORAGE_PROVIDER,
  YANDEX_OBJECT_STORAGE_PROVIDER,
  type PrivateObjectStorageProvider,
} from "@/server/files/object-storage-provider";
import { inferStagingVercelBlobProvider } from "@/server/files/vercel-preview-storage-provider";
import { isValidYandexStorageBucketName } from "@/server/files/yandex-storage-bucket-name";

export type StagingStorageReadinessEnvironment = Readonly<Record<string, string | undefined>>;

export type StagingStorageReadinessPhase = {
  ready: boolean;
  requiredCount: number;
  configuredCount: number;
  missingOrPlaceholder: string[];
  invalidOrInconsistent: string[];
  provider: PrivateObjectStorageProvider | "invalid";
};

export type StagingStorageReadiness = {
  storage: StagingStorageReadinessPhase;
  scanner: StagingStorageReadinessPhase;
};

const PLACEHOLDER_PATTERNS = [
  /replace-with/i,
  /example\.com/i,
  /example\.net/i,
  /postgresql:\/\/USER:PASSWORD@HOST/i,
];

const SCANNER_CORE_REQUIREMENTS = [
  "IB_RUNTIME_TARGET",
  "IB_FILE_SCANNER_TARGET",
  "IB_FILE_SCANNER_ORIGIN",
  "IB_FILE_SCANNER_SECRET",
  "IB_STAGING_FILE_SCANNER_ORIGIN",
  "IB_STAGING_FILE_SCANNER_SECRET_SHA256",
  "IB_STAGING_FILE_SCANNER_CLEAN_OBJECT_KEY",
  "IB_STAGING_FILE_SCANNER_MALICIOUS_OBJECT_KEY",
  "IB_STAGING_FILE_SCANNER_CONFIRM",
] as const;

const YANDEX_STORAGE_REQUIREMENTS = [
  "IB_RUNTIME_TARGET",
  "IB_STAGING_BASE_URL",
  "IB_STORAGE_TARGET",
  "IB_STAGING_STORAGE_BUCKET",
  "IB_STAGING_STORAGE_ALLOWED_ORIGIN",
  "IB_STAGING_STORAGE_ACCESS_KEY_ID",
  "YANDEX_STORAGE_BUCKET",
  "YANDEX_STORAGE_ACCESS_KEY_ID",
  "YANDEX_STORAGE_SECRET_ACCESS_KEY",
] as const;

const YANDEX_SCANNER_STORAGE_REQUIREMENTS = [
  "IB_STORAGE_TARGET",
  "IB_STAGING_STORAGE_BUCKET",
  "IB_STAGING_STORAGE_ACCESS_KEY_ID",
  "YANDEX_STORAGE_BUCKET",
  "YANDEX_STORAGE_ACCESS_KEY_ID",
  "YANDEX_STORAGE_SECRET_ACCESS_KEY",
] as const;

function isConfigured(value: string | undefined): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return !PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(trimmed));
}

function hasUnsafeControlCharacters(value: string | undefined): boolean {
  return Boolean(value && /[\r\n\0]/.test(value));
}

function safeOrigin(value: string | undefined, allowLoopbackHttp: boolean): URL | null {
  if (!isConfigured(value)) return null;
  let parsed: URL;
  try {
    parsed = new URL(value!.trim());
  } catch {
    return null;
  }
  const hostname = parsed.hostname.toLowerCase().replace(/\.+$/, "");
  const loopback = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
  const protocolAllowed =
    parsed.protocol === "https:" || (allowLoopbackHttp && loopback && parsed.protocol === "http:");
  const originOnly =
    (parsed.pathname === "/" || parsed.pathname === "") &&
    !parsed.search &&
    !parsed.hash &&
    !parsed.username &&
    !parsed.password;
  return protocolAllowed && originOnly ? parsed : null;
}

function isProductionHostname(url: URL | null): boolean {
  if (!url) return false;
  const hostname = url.hostname.toLowerCase().replace(/\.+$/, "");
  return hostname === "iburo127.ru" || hostname.endsWith(".iburo127.ru");
}

function unique(names: readonly string[]) {
  return [...new Set(names)];
}

function resolveProvider(env: StagingStorageReadinessEnvironment): {
  provider: PrivateObjectStorageProvider | null;
  invalid: string[];
} {
  const explicit = env.IB_OBJECT_STORAGE_PROVIDER?.trim();
  if (explicit) {
    if (explicit === YANDEX_OBJECT_STORAGE_PROVIDER || explicit === VERCEL_BLOB_STORAGE_PROVIDER) {
      return { provider: explicit, invalid: [] };
    }
    return { provider: null, invalid: ["IB_OBJECT_STORAGE_PROVIDER"] };
  }

  const inferred = inferStagingVercelBlobProvider(env);
  if (inferred) return { provider: inferred, invalid: [] };
  return { provider: YANDEX_OBJECT_STORAGE_PROVIDER, invalid: [] };
}

function vercelAuthRequirements(env: StagingStorageReadinessEnvironment): string[] {
  const mode = env.IB_VERCEL_BLOB_AUTH_MODE?.trim();
  if (mode === "oidc") {
    const storeName = isConfigured(env.BLOB_STORE_ID) ? "BLOB_STORE_ID" : "IB_VERCEL_BLOB_STORE_ID";
    return ["IB_VERCEL_BLOB_AUTH_MODE", "VERCEL_OIDC_TOKEN", storeName];
  }
  if (mode === "read-write-token") {
    return ["IB_VERCEL_BLOB_AUTH_MODE", "BLOB_READ_WRITE_TOKEN"];
  }
  if (!mode && isConfigured(env.BLOB_READ_WRITE_TOKEN)) {
    return ["BLOB_READ_WRITE_TOKEN"];
  }
  return ["IB_VERCEL_BLOB_AUTH_MODE", "BLOB_READ_WRITE_TOKEN"];
}

function vercelInvalid(env: StagingStorageReadinessEnvironment): string[] {
  const invalid = new Set<string>();
  const mode = env.IB_VERCEL_BLOB_AUTH_MODE?.trim();
  if (mode && mode !== "read-write-token" && mode !== "oidc") {
    invalid.add("IB_VERCEL_BLOB_AUTH_MODE");
  }
  for (const name of [
    "IB_VERCEL_BLOB_AUTH_MODE",
    "BLOB_READ_WRITE_TOKEN",
    "VERCEL_OIDC_TOKEN",
    "IB_VERCEL_BLOB_STORE_ID",
    "BLOB_STORE_ID",
  ]) {
    if (hasUnsafeControlCharacters(env[name])) invalid.add(name);
  }
  return [...invalid].sort();
}

function commonStorageInvalid(env: StagingStorageReadinessEnvironment): string[] {
  const invalid = new Set<string>();
  if (isConfigured(env.IB_RUNTIME_TARGET) && env.IB_RUNTIME_TARGET?.trim() !== "staging") {
    invalid.add("IB_RUNTIME_TARGET");
  }
  if (isConfigured(env.IB_STORAGE_TARGET) && env.IB_STORAGE_TARGET?.trim() !== "staging") {
    invalid.add("IB_STORAGE_TARGET");
  }
  const stagingBase = safeOrigin(env.IB_STAGING_BASE_URL, true);
  if (isConfigured(env.IB_STAGING_BASE_URL) && (!stagingBase || isProductionHostname(stagingBase))) {
    invalid.add("IB_STAGING_BASE_URL");
  }
  return [...invalid];
}

function yandexStorageInvalid(env: StagingStorageReadinessEnvironment): string[] {
  const invalid = new Set<string>(commonStorageInvalid(env));
  for (const bucketName of ["YANDEX_STORAGE_BUCKET", "IB_STAGING_STORAGE_BUCKET"]) {
    if (isConfigured(env[bucketName]) && !isValidYandexStorageBucketName(env[bucketName]!.trim())) {
      invalid.add(bucketName);
    }
  }
  if (
    isConfigured(env.YANDEX_STORAGE_BUCKET) &&
    isConfigured(env.IB_STAGING_STORAGE_BUCKET) &&
    env.YANDEX_STORAGE_BUCKET?.trim() !== env.IB_STAGING_STORAGE_BUCKET?.trim()
  ) {
    invalid.add("YANDEX_STORAGE_BUCKET");
    invalid.add("IB_STAGING_STORAGE_BUCKET");
  }
  if (
    isConfigured(env.YANDEX_STORAGE_ACCESS_KEY_ID) &&
    isConfigured(env.IB_STAGING_STORAGE_ACCESS_KEY_ID) &&
    env.YANDEX_STORAGE_ACCESS_KEY_ID?.trim() !== env.IB_STAGING_STORAGE_ACCESS_KEY_ID?.trim()
  ) {
    invalid.add("YANDEX_STORAGE_ACCESS_KEY_ID");
    invalid.add("IB_STAGING_STORAGE_ACCESS_KEY_ID");
  }
  for (const name of [
    "YANDEX_STORAGE_ACCESS_KEY_ID",
    "IB_STAGING_STORAGE_ACCESS_KEY_ID",
    "YANDEX_STORAGE_SECRET_ACCESS_KEY",
  ]) {
    if (hasUnsafeControlCharacters(env[name])) invalid.add(name);
  }
  const allowedOrigin = safeOrigin(env.IB_STAGING_STORAGE_ALLOWED_ORIGIN, true);
  if (
    isConfigured(env.IB_STAGING_STORAGE_ALLOWED_ORIGIN) &&
    (!allowedOrigin || isProductionHostname(allowedOrigin))
  ) {
    invalid.add("IB_STAGING_STORAGE_ALLOWED_ORIGIN");
  }
  const stagingBase = safeOrigin(env.IB_STAGING_BASE_URL, true);
  if (stagingBase && allowedOrigin && stagingBase.origin !== allowedOrigin.origin) {
    invalid.add("IB_STAGING_BASE_URL");
    invalid.add("IB_STAGING_STORAGE_ALLOWED_ORIGIN");
  }
  return [...invalid].sort();
}

function scannerCoreInvalid(
  env: StagingStorageReadinessEnvironment,
  provider: PrivateObjectStorageProvider,
): string[] {
  const invalid = new Set<string>();
  if (isConfigured(env.IB_RUNTIME_TARGET) && env.IB_RUNTIME_TARGET?.trim() !== "staging") {
    invalid.add("IB_RUNTIME_TARGET");
  }
  if (isConfigured(env.IB_FILE_SCANNER_TARGET) && env.IB_FILE_SCANNER_TARGET?.trim() !== "staging") {
    invalid.add("IB_FILE_SCANNER_TARGET");
  }
  if (isConfigured(env.IB_STORAGE_TARGET) && env.IB_STORAGE_TARGET?.trim() !== "staging") {
    invalid.add("IB_STORAGE_TARGET");
  }

  const scannerOrigin = safeOrigin(env.IB_FILE_SCANNER_ORIGIN, false);
  const expectedOrigin = safeOrigin(env.IB_STAGING_FILE_SCANNER_ORIGIN, false);
  if (isConfigured(env.IB_FILE_SCANNER_ORIGIN) && !scannerOrigin) invalid.add("IB_FILE_SCANNER_ORIGIN");
  if (isConfigured(env.IB_STAGING_FILE_SCANNER_ORIGIN) && !expectedOrigin) {
    invalid.add("IB_STAGING_FILE_SCANNER_ORIGIN");
  }
  if (scannerOrigin && expectedOrigin && scannerOrigin.origin !== expectedOrigin.origin) {
    invalid.add("IB_FILE_SCANNER_ORIGIN");
    invalid.add("IB_STAGING_FILE_SCANNER_ORIGIN");
  }

  const scannerSecret = env.IB_FILE_SCANNER_SECRET?.trim();
  if (isConfigured(env.IB_FILE_SCANNER_SECRET) && (!scannerSecret || scannerSecret.length < 32 || hasUnsafeControlCharacters(scannerSecret))) {
    invalid.add("IB_FILE_SCANNER_SECRET");
  }
  const fingerprint = env.IB_STAGING_FILE_SCANNER_SECRET_SHA256?.trim().toLowerCase();
  if (isConfigured(env.IB_STAGING_FILE_SCANNER_SECRET_SHA256) && !/^[a-f0-9]{64}$/.test(fingerprint ?? "")) {
    invalid.add("IB_STAGING_FILE_SCANNER_SECRET_SHA256");
  }

  const cleanKey = env.IB_STAGING_FILE_SCANNER_CLEAN_OBJECT_KEY?.trim();
  const maliciousKey = env.IB_STAGING_FILE_SCANNER_MALICIOUS_OBJECT_KEY?.trim();
  const validFixture = (value: string | undefined) =>
    Boolean(
      value &&
        value.length <= 512 &&
        value.startsWith("security-fixtures/file-scanner/") &&
        !value.includes("..") &&
        !value.includes("\\") &&
        !/[\r\n\0]/.test(value) &&
        /^[A-Za-z0-9._/-]+$/.test(value),
    );
  if (isConfigured(cleanKey) && !validFixture(cleanKey)) invalid.add("IB_STAGING_FILE_SCANNER_CLEAN_OBJECT_KEY");
  if (isConfigured(maliciousKey) && !validFixture(maliciousKey)) {
    invalid.add("IB_STAGING_FILE_SCANNER_MALICIOUS_OBJECT_KEY");
  }
  if (cleanKey && maliciousKey && cleanKey === maliciousKey) {
    invalid.add("IB_STAGING_FILE_SCANNER_CLEAN_OBJECT_KEY");
    invalid.add("IB_STAGING_FILE_SCANNER_MALICIOUS_OBJECT_KEY");
  }

  if (expectedOrigin && /^[a-f0-9]{64}$/.test(fingerprint ?? "")) {
    const identity =
      provider === VERCEL_BLOB_STORAGE_PROVIDER
        ? VERCEL_BLOB_STORAGE_PROVIDER
        : env.IB_STAGING_STORAGE_BUCKET?.trim();
    if (identity) {
      const expected = `FILE-SCANNER-SMOKE:${expectedOrigin.hostname}:${identity}:${fingerprint}`;
      if (
        isConfigured(env.IB_STAGING_FILE_SCANNER_CONFIRM) &&
        env.IB_STAGING_FILE_SCANNER_CONFIRM?.trim() !== expected
      ) {
        invalid.add("IB_STAGING_FILE_SCANNER_CONFIRM");
      }
    }
  }

  return [...invalid].sort();
}

function phase(
  required: readonly string[],
  invalid: readonly string[],
  env: StagingStorageReadinessEnvironment,
  provider: PrivateObjectStorageProvider | null,
): StagingStorageReadinessPhase {
  const requirements = unique(required);
  const missingOrPlaceholder = requirements.filter((name) => !isConfigured(env[name]));
  const invalidOrInconsistent = unique(invalid).sort();
  return {
    ready: provider !== null && missingOrPlaceholder.length === 0 && invalidOrInconsistent.length === 0,
    requiredCount: requirements.length,
    configuredCount: requirements.length - missingOrPlaceholder.length,
    missingOrPlaceholder,
    invalidOrInconsistent,
    provider: provider ?? "invalid",
  };
}

export function buildProviderAwareStagingStorageReadiness(
  env: StagingStorageReadinessEnvironment,
): StagingStorageReadiness {
  const resolved = resolveProvider(env);
  if (!resolved.provider) {
    const invalid = [...resolved.invalid];
    return {
      storage: phase(["IB_RUNTIME_TARGET", "IB_STAGING_BASE_URL", "IB_STORAGE_TARGET"], invalid, env, null),
      scanner: phase([...SCANNER_CORE_REQUIREMENTS, "IB_STORAGE_TARGET"], invalid, env, null),
    };
  }

  if (resolved.provider === YANDEX_OBJECT_STORAGE_PROVIDER) {
    const storageInvalid = yandexStorageInvalid(env);
    const scannerInvalid = unique([
      ...scannerCoreInvalid(env, resolved.provider),
      ...yandexStorageInvalid({ ...env, IB_STAGING_BASE_URL: undefined, IB_STAGING_STORAGE_ALLOWED_ORIGIN: undefined }),
    ]);
    return {
      storage: phase(YANDEX_STORAGE_REQUIREMENTS, storageInvalid, env, resolved.provider),
      scanner: phase(
        [...SCANNER_CORE_REQUIREMENTS, ...YANDEX_SCANNER_STORAGE_REQUIREMENTS],
        scannerInvalid,
        env,
        resolved.provider,
      ),
    };
  }

  const authRequirements = vercelAuthRequirements(env);
  const storageRequirements = [
    "IB_RUNTIME_TARGET",
    "IB_STAGING_BASE_URL",
    "IB_STORAGE_TARGET",
    ...authRequirements,
  ];
  const scannerRequirements = [
    ...SCANNER_CORE_REQUIREMENTS,
    "IB_STORAGE_TARGET",
    ...authRequirements,
  ];
  const authInvalid = vercelInvalid(env);
  return {
    storage: phase(
      storageRequirements,
      unique([...commonStorageInvalid(env), ...authInvalid]),
      env,
      resolved.provider,
    ),
    scanner: phase(
      scannerRequirements,
      unique([...scannerCoreInvalid(env, resolved.provider), ...authInvalid]),
      env,
      resolved.provider,
    ),
  };
}

export function isExactVercelBlobStagingAutoDetectEnvironment(
  env: StagingStorageReadinessEnvironment,
): boolean {
  return (
    !env.IB_OBJECT_STORAGE_PROVIDER?.trim() &&
    env.VERCEL_ENV?.trim() === "preview" &&
    env.VERCEL_GIT_COMMIT_REF?.trim() === VERCEL_STAGING_BRANCH &&
    env.IB_RUNTIME_TARGET?.trim() === "staging" &&
    Boolean(env.BLOB_READ_WRITE_TOKEN?.trim()) &&
    !hasUnsafeControlCharacters(env.BLOB_READ_WRITE_TOKEN) &&
    inferStagingVercelBlobProvider(env) === VERCEL_BLOB_STORAGE_PROVIDER
  );
}
