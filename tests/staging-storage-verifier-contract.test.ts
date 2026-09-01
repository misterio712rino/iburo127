import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  OBJECT_STORAGE_PROVIDER_CONFIG_ERROR,
  readPrivateObjectStorageProvider,
  VERCEL_BLOB_STORAGE_PROVIDER,
  YANDEX_OBJECT_STORAGE_PROVIDER,
} from "../server/files/object-storage-provider";
import {
  readVercelBlobAuthConfig,
  VERCEL_BLOB_CONFIG_ERROR,
} from "../server/files/vercel-blob-config";

const verifierSource = await readFile(resolve("scripts/verify-staging-object-storage.ts"), "utf8");
const guardSource = await readFile(resolve("scripts/staging-storage-target-guard.ts"), "utf8");
const readinessRouteSource = await readFile(
  resolve("app/%5Fiburo/staging-external-readiness/route.ts"),
  "utf8",
);
const runtimeSource = await readFile(resolve("server/files/object-storage-runtime.ts"), "utf8");
const vercelBlobSource = await readFile(
  resolve("server/files/vercel-blob-object-storage.ts"),
  "utf8",
);

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
assert.match(runtimeSource, /readPrivateObjectStorageProvider\(\)/);
assert.match(runtimeSource, /provider === VERCEL_BLOB_STORAGE_PROVIDER/);
assert.match(runtimeSource, /OBJECT_STORAGE_PROVIDER_UNAVAILABLE/);
assert.ok(
  runtimeSource.indexOf("provider === VERCEL_BLOB_STORAGE_PROVIDER") <
    runtimeSource.indexOf("readYandexObjectStorageConfig()"),
  "unsupported Blob activation must fail closed before any Yandex credential read",
);

assert.deepEqual(
  readVercelBlobAuthConfig({
    IB_VERCEL_BLOB_AUTH_MODE: "read-write-token",
    BLOB_READ_WRITE_TOKEN: "private-blob-token",
  }),
  { mode: "read-write-token", token: "private-blob-token" },
);
assert.deepEqual(
  readVercelBlobAuthConfig({
    IB_VERCEL_BLOB_AUTH_MODE: "oidc",
    VERCEL_OIDC_TOKEN: "oidc-token",
    IB_VERCEL_BLOB_STORE_ID: "store-id",
  }),
  { mode: "oidc", oidcToken: "oidc-token", storeId: "store-id" },
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
assert.throws(
  () => readVercelBlobAuthConfig({ BLOB_READ_WRITE_TOKEN: "private-blob-token" }),
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
  new RegExp(`${VERCEL_BLOB_CONFIG_ERROR}:missing IB_VERCEL_BLOB_STORE_ID`),
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
assert.match(readinessRouteSource, /isVercelPreviewBackendAllowed\(env\)/);
assert.match(readinessRouteSource, /VERCEL_STAGING_BRANCH/);
assert.match(readinessRouteSource, /inventory\.phases\.storage/);
assert.match(readinessRouteSource, /inventory\.phases\.scanner/);
assert.match(readinessRouteSource, /networkAccessed:\s*inventory\.networkAccessed/);
assert.match(readinessRouteSource, /valuesPrinted:\s*inventory\.valuesPrinted/);
assert.match(readinessRouteSource, /status:\s*404/);
assert.match(readinessRouteSource, /Cache-Control": "private, no-store, max-age=0"/);
assert.doesNotMatch(readinessRouteSource, /S3Client|HeadObjectCommand|GetObjectCommand|fetch\(|new Pool|PrismaClient/);
assert.doesNotMatch(
  readinessRouteSource,
  /process\.env\.(?:YANDEX_STORAGE_SECRET_ACCESS_KEY|IB_FILE_SCANNER_SECRET|DATABASE_URL)/,
  "readiness route must never access or serialize individual secret values",
);

console.log("STAGING_STORAGE_VERIFIER_CONTRACT_PASS");
