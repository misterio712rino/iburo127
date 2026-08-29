import { createHash, timingSafeEqual } from "node:crypto";

export const STAGING_FILE_SCANNER_TARGET_GUARD = "STAGING_FILE_SCANNER_TARGET_GUARD";
const FIXTURE_PREFIX = "security-fixtures/file-scanner/";

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

function normalizeHttpsOrigin(value: string, code: string) {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    fail(code);
  }

  const originOnly =
    parsed.protocol === "https:" &&
    (parsed.pathname === "/" || parsed.pathname === "") &&
    !parsed.search &&
    !parsed.hash &&
    !parsed.username &&
    !parsed.password;
  if (!originOnly) fail(code);
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

export type StagingFileScannerTarget = {
  scannerOrigin: string;
  scannerSecret: string;
  storageBucket: string;
  cleanObjectKey: string;
  maliciousObjectKey: string;
};

export function assertStagingFileScannerTarget(
  env: Readonly<Record<string, string | undefined>>,
): StagingFileScannerTarget {
  if (env.IB_FILE_SCANNER_TARGET?.trim() !== "staging") fail("SCANNER_TARGET_NOT_STAGING");
  if (env.IB_STORAGE_TARGET?.trim() !== "staging") fail("STORAGE_TARGET_NOT_STAGING");

  const scannerOrigin = normalizeHttpsOrigin(
    requireValue(env, "IB_FILE_SCANNER_ORIGIN"),
    "INVALID_SCANNER_ORIGIN",
  );
  const expectedScannerOrigin = normalizeHttpsOrigin(
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

  const storageBucket = requireValue(env, "YANDEX_STORAGE_BUCKET");
  const expectedBucket = requireValue(env, "IB_STAGING_STORAGE_BUCKET");
  if (!safeEqual(storageBucket, expectedBucket)) fail("STORAGE_BUCKET_MISMATCH");

  const storageAccessKeyId = requireValue(env, "YANDEX_STORAGE_ACCESS_KEY_ID");
  const expectedStorageAccessKeyId = requireValue(env, "IB_STAGING_STORAGE_ACCESS_KEY_ID");
  if (!safeEqual(storageAccessKeyId, expectedStorageAccessKeyId)) {
    fail("STORAGE_ACCESS_KEY_ID_MISMATCH");
  }

  const cleanObjectKey = requireFixtureKey(env, "IB_STAGING_FILE_SCANNER_CLEAN_OBJECT_KEY");
  const maliciousObjectKey = requireFixtureKey(
    env,
    "IB_STAGING_FILE_SCANNER_MALICIOUS_OBJECT_KEY",
  );
  if (safeEqual(cleanObjectKey, maliciousObjectKey)) fail("FIXTURE_KEYS_MUST_DIFFER");

  const expectedConfirmation = `FILE-SCANNER-SMOKE:${new URL(expectedScannerOrigin).hostname}:${expectedBucket}:${expectedSecretFingerprint}`;
  const confirmation = env.IB_STAGING_FILE_SCANNER_CONFIRM?.trim() ?? "";
  if (!confirmation || !safeEqual(confirmation, expectedConfirmation)) {
    fail("CONFIRMATION_MISMATCH");
  }

  return {
    scannerOrigin,
    scannerSecret,
    storageBucket,
    cleanObjectKey,
    maliciousObjectKey,
  };
}
