import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  assertStagingFileScannerTarget,
  STAGING_FILE_SCANNER_TARGET_GUARD,
} from "@/scripts/staging-file-scanner-target-guard";

const scannerSecret = "scanner-staging-secret-" + "x".repeat(24);
const scannerSecretFingerprint = createHash("sha256")
  .update(scannerSecret, "utf8")
  .digest("hex");
const base = {
  IB_RUNTIME_TARGET: "staging",
  IB_FILE_SCANNER_TARGET: "staging",
  IB_STORAGE_TARGET: "staging",
  IB_FILE_SCANNER_ORIGIN: "https://scanner-staging.example.com",
  IB_STAGING_FILE_SCANNER_ORIGIN: "https://scanner-staging.example.com",
  IB_FILE_SCANNER_SECRET: scannerSecret,
  IB_STAGING_FILE_SCANNER_SECRET_SHA256: scannerSecretFingerprint,
  YANDEX_STORAGE_BUCKET: "private-iburo-staging-files",
  IB_STAGING_STORAGE_BUCKET: "private-iburo-staging-files",
  YANDEX_STORAGE_ACCESS_KEY_ID: "staging-storage-key-id",
  IB_STAGING_STORAGE_ACCESS_KEY_ID: "staging-storage-key-id",
  IB_STAGING_FILE_SCANNER_CLEAN_OBJECT_KEY:
    "security-fixtures/file-scanner/clean.txt",
  IB_STAGING_FILE_SCANNER_MALICIOUS_OBJECT_KEY:
    "security-fixtures/file-scanner/eicar.txt",
  IB_STAGING_FILE_SCANNER_CONFIRM: `FILE-SCANNER-SMOKE:scanner-staging.example.com:private-iburo-staging-files:${scannerSecretFingerprint}`,
} satisfies Record<string, string>;

const target = assertStagingFileScannerTarget(base);
assert.equal(target.providerCode, "yandex-object-storage");
assert.equal(target.scannerOrigin, "https://scanner-staging.example.com");
assert.equal(target.storageBucket, "private-iburo-staging-files");
assert.equal(target.cleanObjectKey, "security-fixtures/file-scanner/clean.txt");
assert.equal(target.maliciousObjectKey, "security-fixtures/file-scanner/eicar.txt");

function expectGuardFailure(
  overrides: Partial<Record<keyof typeof base, string | undefined>>,
  expectedCode: string,
) {
  const env = { ...base, ...overrides } as Record<string, string | undefined>;
  assert.throws(
    () => assertStagingFileScannerTarget(env),
    new RegExp(`${STAGING_FILE_SCANNER_TARGET_GUARD}:${expectedCode}`),
  );
}

expectGuardFailure({ IB_RUNTIME_TARGET: "production" }, "RUNTIME_TARGET_NOT_STAGING");
expectGuardFailure({ IB_FILE_SCANNER_TARGET: "production" }, "SCANNER_TARGET_NOT_STAGING");
expectGuardFailure({ IB_STORAGE_TARGET: "production" }, "STORAGE_TARGET_NOT_STAGING");
expectGuardFailure({ IB_FILE_SCANNER_ORIGIN: "http://scanner-staging.example.com" }, "INVALID_SCANNER_ORIGIN");
expectGuardFailure({ IB_FILE_SCANNER_ORIGIN: "https://scanner-other.example.com" }, "INVALID_SCANNER_ORIGIN");
expectGuardFailure({ IB_FILE_SCANNER_ORIGIN: "https://scanner-staging-other.example.com" }, "SCANNER_ORIGIN_MISMATCH");
expectGuardFailure(
  {
    IB_FILE_SCANNER_ORIGIN: "https://scanner-prod-staging.example.com",
    IB_STAGING_FILE_SCANNER_ORIGIN: "https://scanner-prod-staging.example.com",
  },
  "INVALID_SCANNER_ORIGIN",
);
expectGuardFailure(
  {
    IB_FILE_SCANNER_ORIGIN: "https://scanner-staging.iburo127.ru",
    IB_STAGING_FILE_SCANNER_ORIGIN: "https://scanner-staging.iburo127.ru",
  },
  "INVALID_SCANNER_ORIGIN",
);
expectGuardFailure(
  {
    IB_FILE_SCANNER_ORIGIN: "https://scanner-staging.example.com:8443",
    IB_STAGING_FILE_SCANNER_ORIGIN: "https://scanner-staging.example.com:8443",
  },
  "INVALID_SCANNER_ORIGIN",
);
expectGuardFailure({ IB_FILE_SCANNER_SECRET: "short" }, "INVALID_SCANNER_SECRET");
expectGuardFailure(
  { IB_STAGING_FILE_SCANNER_SECRET_SHA256: "not-a-fingerprint" },
  "INVALID_SCANNER_SECRET_FINGERPRINT",
);
expectGuardFailure(
  { IB_STAGING_FILE_SCANNER_SECRET_SHA256: "0".repeat(64) },
  "SCANNER_SECRET_MISMATCH",
);
expectGuardFailure({ YANDEX_STORAGE_BUCKET: "production-files" }, "STORAGE_BUCKET_MISMATCH");
expectGuardFailure(
  { YANDEX_STORAGE_ACCESS_KEY_ID: "different-key" },
  "STORAGE_ACCESS_KEY_ID_MISMATCH",
);
expectGuardFailure(
  { IB_STAGING_FILE_SCANNER_CLEAN_OBJECT_KEY: "cases/client-1/document.pdf" },
  "INVALID_IB_STAGING_FILE_SCANNER_CLEAN_OBJECT_KEY",
);
expectGuardFailure(
  {
    IB_STAGING_FILE_SCANNER_MALICIOUS_OBJECT_KEY:
      "security-fixtures/file-scanner/../client-document.pdf",
  },
  "INVALID_IB_STAGING_FILE_SCANNER_MALICIOUS_OBJECT_KEY",
);
expectGuardFailure(
  {
    IB_STAGING_FILE_SCANNER_MALICIOUS_OBJECT_KEY:
      "security-fixtures/file-scanner/clean.txt",
  },
  "FIXTURE_KEYS_MUST_DIFFER",
);
expectGuardFailure({ IB_STAGING_FILE_SCANNER_CONFIRM: "wrong" }, "CONFIRMATION_MISMATCH");

const vercelBase = {
  IB_RUNTIME_TARGET: "staging",
  IB_FILE_SCANNER_TARGET: "staging",
  IB_STORAGE_TARGET: "staging",
  VERCEL_ENV: "preview",
  VERCEL_GIT_COMMIT_REF: "audit/production-readiness",
  BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_stagingstore123_secret",
  IB_FILE_SCANNER_ORIGIN: "https://scanner-staging.example.com",
  IB_STAGING_FILE_SCANNER_ORIGIN: "https://scanner-staging.example.com",
  IB_FILE_SCANNER_SECRET: scannerSecret,
  IB_STAGING_FILE_SCANNER_SECRET_SHA256: scannerSecretFingerprint,
  IB_STAGING_VERCEL_BLOB_PRIVATE_HOST:
    "stagingstore123.private.blob.vercel-storage.com",
  IB_STAGING_FILE_SCANNER_CLEAN_OBJECT_KEY:
    "security-fixtures/file-scanner/clean.txt",
  IB_STAGING_FILE_SCANNER_MALICIOUS_OBJECT_KEY:
    "security-fixtures/file-scanner/eicar.txt",
  IB_STAGING_FILE_SCANNER_CONFIRM: `FILE-SCANNER-SMOKE:scanner-staging.example.com:vercel-blob:${scannerSecretFingerprint}`,
} satisfies Record<string, string>;

const vercelTarget = assertStagingFileScannerTarget(vercelBase);
assert.equal(vercelTarget.providerCode, "vercel-blob");
assert.equal("storageBucket" in vercelTarget, false);
assert.equal(
  vercelTarget.expectedPrivateBlobHost,
  "stagingstore123.private.blob.vercel-storage.com",
);

function expectVercelGuardFailure(
  overrides: Partial<Record<string, string | undefined>>,
  expectedCode: string,
) {
  const env = { ...vercelBase, ...overrides } as Record<string, string | undefined>;
  assert.throws(
    () => assertStagingFileScannerTarget(env),
    new RegExp(`${STAGING_FILE_SCANNER_TARGET_GUARD}:${expectedCode}`),
  );
}

expectVercelGuardFailure({ VERCEL_ENV: "production" }, "VERCEL_ENV_NOT_PREVIEW");
expectVercelGuardFailure(
  { IB_STAGING_VERCEL_BLOB_PRIVATE_HOST: undefined },
  "MISSING_IB_STAGING_VERCEL_BLOB_PRIVATE_HOST",
);
expectVercelGuardFailure(
  { IB_STAGING_VERCEL_BLOB_PRIVATE_HOST: "https://stagingstore123.private.blob.vercel-storage.com" },
  "INVALID_IB_STAGING_VERCEL_BLOB_PRIVATE_HOST",
);
expectVercelGuardFailure(
  { IB_STAGING_VERCEL_BLOB_PRIVATE_HOST: "production.example.com" },
  "INVALID_IB_STAGING_VERCEL_BLOB_PRIVATE_HOST",
);
expectVercelGuardFailure({ IB_STAGING_FILE_SCANNER_CONFIRM: "wrong" }, "CONFIRMATION_MISMATCH");
expectVercelGuardFailure(
  { IB_OBJECT_STORAGE_PROVIDER: "vercel-blob" },
  "VERCEL_PROVIDER_NOT_EXACT_STAGING_PREVIEW",
);
expectVercelGuardFailure(
  { IB_OBJECT_STORAGE_PROVIDER: "yandex-object-storage" },
  "VERCEL_PROVIDER_NOT_EXACT_STAGING_PREVIEW",
);

console.log("STAGING_FILE_SCANNER_TARGET_GUARD_TEST_PASS");
