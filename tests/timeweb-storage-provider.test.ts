import assert from "node:assert/strict";
import {
  readTimewebObjectStorageConfig,
  TIMEWEB_S3_ENDPOINT,
  TIMEWEB_S3_REGION,
  TimewebPrivateObjectStorage,
} from "@/server/files/timeweb-s3-object-storage";
import { readPrivateObjectStorageProvider } from "@/server/files/object-storage-provider";
import { assertStagingStorageTarget } from "@/scripts/staging-storage-target-guard";
import { buildProviderAwareStagingStorageReadiness } from "@/scripts/staging-storage-readiness";

const config = readTimewebObjectStorageConfig({
  TIMEWEB_STORAGE_BUCKET: "private-iburo-staging-files",
  TIMEWEB_STORAGE_ACCESS_KEY_ID: "staging-key-id",
  TIMEWEB_STORAGE_SECRET_ACCESS_KEY: "staging-key-secret",
} as unknown as NodeJS.ProcessEnv);

assert.equal(config.endpoint, "https://s3.twcstorage.ru");
assert.equal(config.region, "ru-1");
assert.equal(TIMEWEB_S3_ENDPOINT, config.endpoint);
assert.equal(TIMEWEB_S3_REGION, config.region);
assert.equal(readPrivateObjectStorageProvider({ IB_OBJECT_STORAGE_PROVIDER: "timeweb-object-storage" }), "timeweb-object-storage");

const stagingEnv = {
  IB_OBJECT_STORAGE_PROVIDER: "timeweb-object-storage",
  IB_RUNTIME_TARGET: "staging",
  IB_STAGING_BASE_URL: "https://staging-app.invalid",
  IB_STORAGE_TARGET: "staging",
  IB_STAGING_STORAGE_BUCKET: "private-iburo-staging-files",
  IB_STAGING_STORAGE_ALLOWED_ORIGIN: "https://staging-app.invalid",
  IB_STAGING_STORAGE_ACCESS_KEY_ID: "staging-key-id",
  TIMEWEB_STORAGE_BUCKET: "private-iburo-staging-files",
  TIMEWEB_STORAGE_ACCESS_KEY_ID: "staging-key-id",
  TIMEWEB_STORAGE_SECRET_ACCESS_KEY: "staging-key-secret",
} satisfies Record<string, string>;

const target = assertStagingStorageTarget(stagingEnv);
assert.equal(target.provider, "timeweb-object-storage");
assert.equal(target.bucket, "private-iburo-staging-files");
const readiness = buildProviderAwareStagingStorageReadiness(stagingEnv);
assert.equal(readiness.storage.provider, "timeweb-object-storage");
assert.equal(readiness.storage.ready, true);
assert.throws(
  () => readTimewebObjectStorageConfig({ TIMEWEB_STORAGE_BUCKET: "bad bucket" } as unknown as NodeJS.ProcessEnv),
  /PRODUCTION_CONFIG_ERROR:TIMEWEB_STORAGE_BUCKET/,
);

const calls: string[] = [];
const adapter = new TimewebPrivateObjectStorage("private-iburo-staging-files", {
  async signUpload(input) {
    calls.push(`put:${input.bucket}:${input.objectKey}:${input.mimeType}`);
    return "https://signed.example/upload";
  },
  async signDownload(input) {
    calls.push(`get:${input.bucket}:${input.objectKey}`);
    return "https://signed.example/download";
  },
  async statObject(input) {
    calls.push(`head:${input.bucket}:${input.objectKey}`);
    return { sizeBytes: BigInt(12), mimeType: "application/pdf" };
  },
  async readObject(input) {
    calls.push(`read:${input.bucket}:${input.objectKey}:${input.maxBytes}`);
    return new Uint8Array([37, 80, 68, 70]);
  },
  async deleteObject(input) {
    calls.push(`delete:${input.bucket}:${input.objectKey}`);
  },
});

assert.equal(adapter.providerCode, "timeweb-object-storage");
const upload = await adapter.createUploadUrl({
  objectKey: "cases/11111111-1111-1111-1111-111111111111/22222222-2222-2222-2222-222222222222/object.pdf",
  mimeType: "application/pdf",
  sizeBytes: BigInt(12),
  expiresInSeconds: 300,
});
assert.equal(upload.url, "https://signed.example/upload");
assert.ok(upload.expiresAt instanceof Date);
assert.deepEqual(await adapter.statObject("security-fixtures/clean.txt"), {
  sizeBytes: BigInt(12),
  mimeType: "application/pdf",
});
assert.deepEqual(await adapter.readObject("security-fixtures/clean.txt", 1024), new Uint8Array([37, 80, 68, 70]));
await assert.rejects(adapter.readObject("security-fixtures/clean.txt", 50 * 1024 * 1024 + 1), /OBJECT_STORAGE_READ_INVALID_LIMIT/);
await assert.rejects(adapter.readObject("../private.txt", 1024), /OBJECT_STORAGE_INVALID_KEY/);
await adapter.deleteObject("security-fixtures/clean.txt");
assert.equal(calls.length, 4);
assert.equal(calls[2], "read:private-iburo-staging-files:security-fixtures/clean.txt:1024");

console.log("Timeweb object storage tests: PASS");
