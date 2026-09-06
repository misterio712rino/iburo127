import { createHash, timingSafeEqual } from "node:crypto";
import {
  VERCEL_BLOB_STORAGE_PROVIDER,
  YANDEX_OBJECT_STORAGE_PROVIDER,
} from "@/server/files/object-storage-provider";
import { inferStagingVercelBlobProvider } from "@/server/files/vercel-preview-storage-provider";

export const STAGING_FILE_SCANNER_TARGET_GUARD = "STAGING_FILE_SCANNER_TARGET_GUARD";
const FIXTURE_PREFIX = "security-fixtures/file-scanner/";
const STAGING_HOSTNAME_PATTERN = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

function fail(code: string): never {
  throw new Error(`${STAGING_FILE_SCANNER_TARGET_GUARD}:${code}`);
}

function requireValue(env: Readonly<Record<string, string | undefined>>, name: string) {
  const value = env[name]?.trim();
  if (!value) fail(`MISSING_${name}`);
  return value;
}

function digest(value: string) {
  return createHash("sha256").update(value, "utf8").digest();
}

function sha256Hex(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function safeEqual(left: string, right: string) {
  return timingSafeEqual(digest(left), digest(right));
}

function normalizeStagingHttpsOrigin(value: string, code: string) {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    fail(code);
  }

  const hostname = parsed.hostname.toLowerCase();
  const originOnly =
    parsed.protocol === "https:" &&
    !parsed.port &&
    (parsed.pathname === "/" || parsed.pathname === "") &&
    !parsed.search &&
    !parsed.hash &&
    !parsed.username &&
    !parsed.password;
  const stagingHostname =
    STAGING_HOSTNAME_PATTERN.test(hostname) &&
    hostname.includes("staging") &&
    !hostname.includes("prod") &&
    hostname !== "iburo127.ru" &&
    !hostname.endsWith(".iburo127.ru");
  if (!originOnly || !stagingHostname) fail(code);
  return parsed.origin;
}

function requireFixtureKey(
  env: Readonly<Record<string, string | undefined>>,
  name: string,
) {
  const value = requireValue(env, name);
  if (
    value.length > 512 ||
    !value.startsWith(FIXTURE_PREFIX) ||
    value.startsWith("/") ||
    value.includes("..") ||
    value.includes("\\") ||
    /[\r\n\0]/.test(value) ||
    !/^[A-Za-z0-9._/-]+$/.test(value)
  ) {
    fail(`INVALID_${name}`);
  }
  return value;
}

type StagingFileScannerTargetBase = {
  scannerOrigin: string;
  scannerSecret: string;
  cleanObjectKey: string;
  maliciousObjectKey: string;
};

export type StagingFileScannerTarget =
  | (StagingFileScannerTargetBase & {
      providerCode: typeof YANDEX_OBJECT_STORAGE_PROVIDER;
      storageBucket: string;
    })
  | (StagingFileScannerTargetBase & {
      providerCode: typeof VERCEL_BLOB_STORAGE_PROVIDER;
    });

export function assertStagingFileScannerTarget(
  env: Readonly<Record<string, string | undefined>>,
): StagingFileScannerTarget {
  if (env.IB_RUNTIME_TARGET?.trim() !== "staging") fail("RUNTIME_TARGET_NOT_STAGING");
  if (env.IB_FILE_SCANNER_TARGET?.trim() !== "staging") fail("SCANNER_TARGET_NOT_STAGING");
  if (env.IB_STORAGE_TARGET?.trim() !== "staging") fail("STORAGE_TARGET_NOT_STAGING");

  const scannerOrigin = normalizeStagingHttpsOrigin(
    requireValue(env, "IB_FILE_SCANNER_ORIGIN"),
    "INVALID_SCANNER_ORIGIN",
  );
  const expectedScannerOrigin = normalizeStagingHttpsOrigin(
    requireValue(env, "IB_STAGING_FILE_SCANNER_ORIGIN"),
    "INVALID_EXPECTED_SCANNER_ORIGIN",
  );
  if (!safeEqual(scannerOrigin, expectedScannerOrigin)) fail("SCANNER_ORIGIN_MISMATCH");

  const scannerSecret = requireValue(env, "IB_FILE_SCANNER_SECRET");
  if (scannerSecret.length < 32 || /[\r\n\0]/.test(scannerSecret)) {
    fail("INVALID_SCANNER_SECRET");
  }
  const expectedSecretFingerprint = requireValue(
    env,
    "IB_STAGING_FILE_SCANNER_SECRET_SHA256",
  ).toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(expectedSecretFingerprint)) fail("INVALID_SCANNER_SECRET_FINGERPRINT");
  if (!safeEqual(sha256Hex(scannerSecret), expectedSecretFingerprint)) {
    fail("SCANNER_SECRET_MISMATCH");
  }

  const cleanObjectKey = requireFixtureKey(env, "IB_STAGING_FILE_SCANNER_CLEAN_OBJECT_KEY");
  const maliciousObjectKey = requireFixtureKey(
    env,
    "IB_STAGING_FILE_SCANNER_MALICIOUS_OBJECT_KEY",
  );
  if (safeEqual(cleanObjectKey, maliciousObjectKey)) fail("FIXTURE_KEYS_MUST_DIFFER");

  const providerCode = inferStagingVercelBlobProvider(env);
  const explicitProvider = env.IB_OBJECT_STORAGE_PROVIDER?.trim();
  const vercelEnvironment = env.VERCEL_ENV?.trim();
  if (vercelEnvironment && vercelEnvironment !== "preview") {
    fail("VERCEL_ENV_NOT_PREVIEW");
  }
  if (vercelEnvironment === "preview" && providerCode !== VERCEL_BLOB_STORAGE_PROVIDER) {
    fail("VERCEL_PROVIDER_NOT_EXACT_STAGING_PREVIEW");
  }
  if (explicitProvider === VERCEL_BLOB_STORAGE_PROVIDER && providerCode !== VERCEL_BLOB_STORAGE_PROVIDER) {
    fail("VERCEL_PROVIDER_NOT_EXACT_STAGING_PREVIEW");
  }

  if (providerCode === VERCEL_BLOB_STORAGE_PROVIDER) {
    const expectedConfirmation = `FILE-SCANNER-SMOKE:${new URL(expectedScannerOrigin).hostname}:${VERCEL_BLOB_STORAGE_PROVIDER}:${expectedSecretFingerprint}`;
    const confirmation = env.IB_STAGING_FILE_SCANNER_CONFIRM?.trim() ?? "";
    if (!confirmation || !safeEqual(confirmation, expectedConfirmation)) {
      fail("CONFIRMATION_MISMATCH");
    }

    return {
      providerCode: VERCEL_BLOB_STORAGE_PROVIDER,
      scannerOrigin,
      scannerSecret,
      cleanObjectKey,
      maliciousObjectKey,
    };
  }

  if (explicitProvider && explicitProvider !== YANDEX_OBJECT_STORAGE_PROVIDER) {
    fail("UNSUPPORTED_STORAGE_PROVIDER");
  }

  const storageBucket = requireValue(env, "YANDEX_STORAGE_BUCKET");
  const expectedBucket = requireValue(env, "IB_STAGING_STORAGE_BUCKET");
  if (!safeEqual(storageBucket, expectedBucket)) fail("STORAGE_BUCKET_MISMATCH");

  const storageAccessKeyId = requireValue(env, "YANDEX_STORAGE_ACCESS_KEY_ID");
  const expectedStorageAccessKeyId = requireValue(env, "IB_STAGING_STORAGE_ACCESS_KEY_ID");
  if (!safeEqual(storageAccessKeyId, expectedStorageAccessKeyId)) {
    fail("STORAGE_ACCESS_KEY_ID_MISMATCH");
  }

  const expectedConfirmation = `FILE-SCANNER-SMOKE:${new URL(expectedScannerOrigin).hostname}:${expectedBucket}:${expectedSecretFingerprint}`;
  const confirmation = env.IB_STAGING_FILE_SCANNER_CONFIRM?.trim() ?? "";
  if (!confirmation || !safeEqual(confirmation, expectedConfirmation)) {
    fail("CONFIRMATION_MISMATCH");
  }

  return {
    providerCode: YANDEX_OBJECT_STORAGE_PROVIDER,
    scannerOrigin,
    scannerSecret,
    storageBucket,
    cleanObjectKey,
    maliciousObjectKey,
  };
}
