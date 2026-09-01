import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { PrivateObjectStorage } from "../server/files/object-storage-contract";
import { createPrivateObjectStorageForProvider } from "../server/files/object-storage-factory";
import {
  OBJECT_STORAGE_PROVIDER_CONFIG_ERROR,
  OBJECT_STORAGE_PROVIDER_UNAVAILABLE,
  readPrivateObjectStorageProvider,
  VERCEL_BLOB_STORAGE_PROVIDER,
  YANDEX_OBJECT_STORAGE_PROVIDER,
} from "../server/files/object-storage-provider";
import {
  readVercelBlobAuthConfig,
  VERCEL_BLOB_CONFIG_ERROR,
} from "../server/files/vercel-blob-config";
import { toVercelBlobSdkCredentialOptions } from "../server/files/vercel-blob-driver-auth";
import { inferStagingVercelBlobProvider } from "../server/files/vercel-preview-storage-provider";
import {
  buildProviderAwareStagingStorageReadiness,
  isExactVercelBlobStagingAutoDetectEnvironment,
} from "../scripts/staging-storage-readiness";

const verifierSource = await readFile(resolve("scripts/verify-staging-object-storage.ts"), "utf8");
const guardSource = await readFile(resolve("scripts/staging-storage-target-guard.ts"), "utf8");
const readinessRouteSource = await readFile(
  resolve("app/%5Fiburo/staging-external-readiness/route.ts"),
  "utf8",
);
const runtimeSource = await readFile(resolve("server/files/object-storage-runtime.ts"), "utf8");
const factorySource = await readFile(resolve("server/files/object-storage-factory.ts"), "utf8");
const vercelBlobSource = await readFile(
  resolve("server/files/vercel-blob-object-storage.ts"),
  "utf8",
);

function fakeStorage(providerCode: string): PrivateObjectStorage {
  return {
    providerCode,
    async createUploadUrl() {
      throw new Error("TEST_ONLY_NOT_IMPLEMENTED");
    },
    async createDownloadUrl() {
      throw new Error("TEST_ONLY_NOT_IMPLEMENTED");
    },
    async statObject() {
      return null;
    },
    async deleteObject() {},
  };
}

assert.equal(readPrivateObjectStorageProvider({}), YANDEX_OBJECT_STORAGE_PROVIDER);
assert.equal(
  readPrivateObjectStorageProvider({ IB_OBJECT_STORAGE_PROVIDER: YANDEX_OBJECT_STORAGE_PROVIDER }),
  YANDEX_OBJECT_STORAGE_PROVIDER,
);
assert.equal(
  readPrivateObjectStorageProvider({ IB_OBJECT_STORAGE_PROVIDER: VERCEL_BLOB_STORAGE_PROVIDER }),
  VERCEL_BLOB_STORAGE_PROVIDER,
);
assert.throws(
  () => readPrivateObjectStorageProvider({ IB_OBJECT_STORAGE_PROVIDER: "unexpected-provider" }),
  new RegExp(`${OBJECT_STORAGE_PROVIDER_CONFIG_ERROR}:IB_OBJECT_STORAGE_PROVIDER`),
);

const yandexStorage = fakeStorage(YANDEX_OBJECT_STORAGE_PROVIDER);
const vercelStorage = fakeStorage(VERCEL_BLOB_STORAGE_PROVIDER);
assert.equal(
  createPrivateObjectStorageForProvider(YANDEX_OBJECT_STORAGE_PROVIDER, {
    createYandex: () => yandexStorage,
  }),
  yandexStorage,
);
assert.throws(
  () =>
    createPrivateObjectStorageForProvider(VERCEL_BLOB_STORAGE_PROVIDER, {
      createYandex: () => yandexStorage,
    }),
  new RegExp(`${OBJECT_STORAGE_PROVIDER_UNAVAILABLE}:${VERCEL_BLOB_STORAGE_PROVIDER}`),
  "Blob must remain fail closed until a concrete driver-backed constructor is supplied",
);
assert.equal(
  createPrivateObjectStorageForProvider(VERCEL_BLOB_STORAGE_PROVIDER, {
    createYandex: () => yandexStorage,
    createVercelBlob: () => vercelStorage,
  }),
  vercelStorage,
);
assert.throws(
  () =>
    createPrivateObjectStorageForProvider(VERCEL_BLOB_STORAGE_PROVIDER, {
      createYandex: () => yandexStorage,
      createVercelBlob: () => yandexStorage,
    }),
  new RegExp(`${OBJECT_STORAGE_PROVIDER_CONFIG_ERROR}:providerCode`),
  "factory must reject a backend whose provider identity does not match the selected provider",
);

assert.match(runtimeSource, /inferStagingVercelBlobProvider\(process\.env\)/);
assert.match(runtimeSource, /readPrivateObjectStorageProvider\(\)/);
assert.match(runtimeSource, /createPrivateObjectStorageForProvider\(provider/);
assert.match(factorySource, /OBJECT_STORAGE_PROVIDER_UNAVAILABLE/);
assert.match(factorySource, /storage\.providerCode !== provider/);
assert.ok(
  factorySource.indexOf("provider === VERCEL_BLOB_STORAGE_PROVIDER") <
    factorySource.indexOf("dependencies.createYandex()"),
  "Blob selection must fail closed before any Yandex factory is invoked",
);

const staticAuthConfig = readVercelBlobAuthConfig({
  IB_VERCEL_BLOB_AUTH_MODE: "read-write-token",
  BLOB_READ_WRITE_TOKEN: "private-blob-token",
});
assert.deepEqual(staticAuthConfig, { mode: "read-write-token", token: "private-blob-token" });
assert.deepEqual(toVercelBlobSdkCredentialOptions(staticAuthConfig), {
  token: "private-blob-token",
});

assert.deepEqual(
  readVercelBlobAuthConfig({ BLOB_READ_WRITE_TOKEN: "private-blob-token" }),
  { mode: "read-write-token", token: "private-blob-token" },
  "standard Vercel Blob token must safely select static-token auth when no explicit mode is configured",
);

const oidcAuthConfig = readVercelBlobAuthConfig({
  IB_VERCEL_BLOB_AUTH_MODE: "oidc",
  VERCEL_OIDC_TOKEN: "oidc-token",
  IB_VERCEL_BLOB_STORE_ID: "store-id",
});
assert.deepEqual(oidcAuthConfig, { mode: "oidc", oidcToken: "oidc-token", storeId: "store-id" });
assert.deepEqual(toVercelBlobSdkCredentialOptions(oidcAuthConfig), {
  oidcToken: "oidc-token",
  storeId: "store-id",
});
assert.deepEqual(
  readVercelBlobAuthConfig({
    IB_VERCEL_BLOB_AUTH_MODE: "oidc",
    VERCEL_OIDC_TOKEN: "oidc-token",
    BLOB_STORE_ID: "standard-store-id",
  }),
  { mode: "oidc", oidcToken: "oidc-token", storeId: "standard-store-id" },
  "standard Vercel BLOB_STORE_ID must be accepted for OIDC",
);

assert.deepEqual(
  readVercelBlobAuthConfig({
    IB_VERCEL_BLOB_AUTH_MODE: "read-write-token",
    BLOB_READ_WRITE_TOKEN: "private-blob-token",
    VERCEL_OIDC_TOKEN: "ambient-oidc-token",
    IB_VERCEL_BLOB_STORE_ID: "ambient-store-id",
  }),
  { mode: "read-write-token", token: "private-blob-token" },
  "ambient OIDC credentials must not change an explicitly selected auth mode",
);
assert.deepEqual(
  Object.keys(toVercelBlobSdkCredentialOptions(staticAuthConfig)).sort(),
  ["token"],
  "static-token SDK options must not contain OIDC credentials",
);
assert.deepEqual(
  Object.keys(toVercelBlobSdkCredentialOptions(oidcAuthConfig)).sort(),
  ["oidcToken", "storeId"],
  "OIDC SDK options must not contain a static token",
);
assert.throws(
  () => readVercelBlobAuthConfig({}),
  new RegExp(`${VERCEL_BLOB_CONFIG_ERROR}:missing IB_VERCEL_BLOB_AUTH_MODE`),
);
assert.throws(
  () => readVercelBlobAuthConfig({ IB_VERCEL_BLOB_AUTH_MODE: "read-write-token" }),
  new RegExp(`${VERCEL_BLOB_CONFIG_ERROR}:missing BLOB_READ_WRITE_TOKEN`),
);
assert.throws(
  () =>
    readVercelBlobAuthConfig({
      IB_VERCEL_BLOB_AUTH_MODE: "oidc",
      VERCEL_OIDC_TOKEN: "oidc-token",
    }),
  new RegExp(`${VERCEL_BLOB_CONFIG_ERROR}:missing IB_VERCEL_BLOB_STORE_ID or BLOB_STORE_ID`),
);
assert.throws(
  () =>
    readVercelBlobAuthConfig({
      IB_VERCEL_BLOB_AUTH_MODE: "oidc",
      VERCEL_OIDC_TOKEN: "bad\nsecret",
      IB_VERCEL_BLOB_STORE_ID: "store-id",
    }),
  new RegExp(`${VERCEL_BLOB_CONFIG_ERROR}:VERCEL_OIDC_TOKEN contains unsafe control characters`),
);
assert.throws(
  () => readVercelBlobAuthConfig({ IB_VERCEL_BLOB_AUTH_MODE: "unexpected" }),
  new RegExp(`${VERCEL_BLOB_CONFIG_ERROR}:unsupported IB_VERCEL_BLOB_AUTH_MODE:unexpected`),
);

const yandexReadiness = buildProviderAwareStagingStorageReadiness({
  IB_RUNTIME_TARGET: "staging",
  IB_STAGING_BASE_URL: "https://stage.iburo.test",
  IB_STORAGE_TARGET: "staging",
  IB_STAGING_STORAGE_BUCKET: "iburo-stage-private",
  IB_STAGING_STORAGE_ALLOWED_ORIGIN: "https://stage.iburo.test",
  IB_STAGING_STORAGE_ACCESS_KEY_ID: "stage-key",
  YANDEX_STORAGE_BUCKET: "iburo-stage-private",
  YANDEX_STORAGE_ACCESS_KEY_ID: "stage-key",
  YANDEX_STORAGE_SECRET_ACCESS_KEY: "stage-secret",
  IB_FILE_SCANNER_TARGET: "staging",
});
assert.equal(yandexReadiness.storage.provider, YANDEX_OBJECT_STORAGE_PROVIDER);
assert.equal(yandexReadiness.storage.ready, true);

const vercelPreviewEnv = {
  VERCEL_ENV: "preview",
  VERCEL_GIT_COMMIT_REF: "audit/production-readiness",
  IB_RUNTIME_TARGET: "staging",
  IB_STAGING_BASE_URL: "https://stage.iburo.test",
  IB_STORAGE_TARGET: "staging",
  BLOB_READ_WRITE_TOKEN: "vercel-blob-private-token",
} satisfies Record<string, string>;
assert.equal(inferStagingVercelBlobProvider(vercelPreviewEnv), VERCEL_BLOB_STORAGE_PROVIDER);
assert.equal(isExactVercelBlobStagingAutoDetectEnvironment(vercelPreviewEnv), true);
const vercelReadiness = buildProviderAwareStagingStorageReadiness(vercelPreviewEnv);
assert.equal(vercelReadiness.storage.provider, VERCEL_BLOB_STORAGE_PROVIDER);
assert.equal(vercelReadiness.storage.ready, true);
assert.equal(vercelReadiness.storage.missingOrPlaceholder.includes("YANDEX_STORAGE_BUCKET"), false);
assert.equal(vercelReadiness.storage.missingOrPlaceholder.includes("YANDEX_STORAGE_ACCESS_KEY_ID"), false);
assert.equal(vercelReadiness.storage.missingOrPlaceholder.includes("YANDEX_STORAGE_SECRET_ACCESS_KEY"), false);

for (const env of [
  { ...vercelPreviewEnv, VERCEL_ENV: "production" },
  { ...vercelPreviewEnv, VERCEL_GIT_COMMIT_REF: "main" },
  { ...vercelPreviewEnv, IB_RUNTIME_TARGET: "production" },
]) {
  assert.equal(inferStagingVercelBlobProvider(env), undefined);
  assert.equal(isExactVercelBlobStagingAutoDetectEnvironment(env), false);
}

const missingToken = buildProviderAwareStagingStorageReadiness({
  IB_OBJECT_STORAGE_PROVIDER: VERCEL_BLOB_STORAGE_PROVIDER,
  IB_RUNTIME_TARGET: "staging",
  IB_STAGING_BASE_URL: "https://stage.iburo.test",
  IB_STORAGE_TARGET: "staging",
  IB_VERCEL_BLOB_AUTH_MODE: "read-write-token",
});
assert.equal(missingToken.storage.ready, false);
assert.ok(missingToken.storage.missingOrPlaceholder.includes("BLOB_READ_WRITE_TOKEN"));

const malformedProvider = buildProviderAwareStagingStorageReadiness({
  IB_OBJECT_STORAGE_PROVIDER: "unexpected-provider",
  IB_RUNTIME_TARGET: "staging",
  IB_STAGING_BASE_URL: "https://stage.iburo.test",
  IB_STORAGE_TARGET: "staging",
});
assert.equal(malformedProvider.storage.ready, false);
assert.equal(malformedProvider.storage.provider, "invalid");
assert.ok(malformedProvider.storage.invalidOrInconsistent.includes("IB_OBJECT_STORAGE_PROVIDER"));

const scannerStillSeparate = buildProviderAwareStagingStorageReadiness(vercelPreviewEnv);
assert.equal(scannerStillSeparate.scanner.provider, VERCEL_BLOB_STORAGE_PROVIDER);
assert.equal(scannerStillSeparate.scanner.ready, false);
assert.ok(scannerStillSeparate.scanner.missingOrPlaceholder.includes("IB_FILE_SCANNER_SECRET"));
assert.equal(scannerStillSeparate.scanner.missingOrPlaceholder.includes("YANDEX_STORAGE_BUCKET"), false);

const redactionProbe = "secret-value-must-never-print-9f3a2";
const redacted = buildProviderAwareStagingStorageReadiness({
  ...vercelPreviewEnv,
  BLOB_READ_WRITE_TOKEN: redactionProbe,
});
const serializedReadiness = JSON.stringify(redacted);
assert.equal(serializedReadiness.includes(redactionProbe), false);
assert.equal(serializedReadiness.includes("BLOB_READ_WRITE_TOKEN"), false);

assert.match(vercelBlobSource, /export type VercelBlobStorageDriver/);
assert.match(vercelBlobSource, /createPrivateUploadUrl/);
assert.match(vercelBlobSource, /maximumSizeInBytes/);
assert.match(vercelBlobSource, /createPrivateDownloadUrl/);
assert.match(vercelBlobSource, /statPrivateBlob/);
assert.match(vercelBlobSource, /deletePrivateBlob/);
assert.match(vercelBlobSource, /assertSafeObjectKey\(input\.objectKey\)/);
assert.match(vercelBlobSource, /assertSafeSignedUrlTtl\(input\.expiresInSeconds\)/);
assert.match(vercelBlobSource, /toSafeUploadSizeNumber\(input\.sizeBytes\)/);
assert.match(vercelBlobSource, /providerCode = VERCEL_BLOB_STORAGE_PROVIDER/);
assert.doesNotMatch(
  vercelBlobSource,
  /from\s+["']@vercel\/blob["']/,
  "provider-neutral Blob adapter must not couple directly to the concrete SDK",
);

for (const requiredGuardToken of [
  "requireStagingHttpTarget",
  "IB_STORAGE_TARGET",
  "YANDEX_STORAGE_BUCKET",
  "IB_STAGING_STORAGE_BUCKET",
  "YANDEX_STORAGE_ACCESS_KEY_ID",
  "IB_STAGING_STORAGE_ACCESS_KEY_ID",
  "YANDEX_STORAGE_SECRET_ACCESS_KEY",
  "IB_STAGING_STORAGE_ALLOWED_ORIGIN",
  "IB_STAGING_BASE_URL origin",
  "production storage CORS origin is explicitly blocked",
]) {
  assert.match(
    guardSource,
    new RegExp(requiredGuardToken.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    `staging storage guard must enforce ${requiredGuardToken}`,
  );
}

const targetGuardIndex = verifierSource.indexOf("assertStagingStorageTarget()");
const clientIndex = verifierSource.indexOf("new S3Client(");
assert.ok(targetGuardIndex >= 0, "storage verifier must invoke the staging storage target guard");
assert.ok(
  clientIndex > targetGuardIndex,
  "storage target identity must be verified before S3Client construction/network access",
);

assert.match(verifierSource, /HeadBucketCommand/);
assert.match(verifierSource, /GetBucketAclCommand/);
assert.match(verifierSource, /GetBucketPolicyCommand/);
assert.match(verifierSource, /GetBucketCorsCommand/);
assert.match(verifierSource, /assertCorsRules\(corsRules, target\.allowedOrigin\)/);
assert.match(verifierSource, /Object enumeration\/content operations performed: 0/);

for (const forbidden of [
  "ListObjectsCommand",
  "ListObjectsV2Command",
  "GetObjectCommand",
  "PutObjectCommand",
  "DeleteObjectCommand",
]) {
  assert.doesNotMatch(verifierSource, new RegExp(forbidden));
}

assert.doesNotMatch(verifierSource, /console\.(?:log|error)\([^\n]*target\.accessKeyId/);
assert.doesNotMatch(verifierSource, /console\.(?:log|error)\([^\n]*target\.secretAccessKey/);

assert.match(readinessRouteSource, /buildStagingEnvironmentInventory\(env\)/);
assert.match(readinessRouteSource, /buildProviderAwareStagingStorageReadiness\(env\)/);
assert.match(readinessRouteSource, /isVercelPreviewBackendAllowed\(env\)/);
assert.match(readinessRouteSource, /VERCEL_STAGING_BRANCH/);
assert.match(readinessRouteSource, /providerAwareStorage\.storage/);
assert.match(readinessRouteSource, /providerAwareStorage\.scanner/);
assert.match(readinessRouteSource, /networkAccessed:\s*inventory\.networkAccessed/);
assert.match(readinessRouteSource, /valuesPrinted:\s*inventory\.valuesPrinted/);
assert.match(readinessRouteSource, /status:\s*404/);
assert.match(readinessRouteSource, /Cache-Control": "private, no-store, max-age=0"/);
assert.doesNotMatch(readinessRouteSource, /S3Client|HeadObjectCommand|GetObjectCommand|fetch\(|new Pool|PrismaClient/);
assert.doesNotMatch(
  readinessRouteSource,
  /process\.env\.(?:YANDEX_STORAGE_SECRET_ACCESS_KEY|BLOB_READ_WRITE_TOKEN|IB_FILE_SCANNER_SECRET|DATABASE_URL)/,
  "readiness route must never access or serialize individual secret values",
);

console.log("STAGING_STORAGE_VERIFIER_CONTRACT_PASS");
