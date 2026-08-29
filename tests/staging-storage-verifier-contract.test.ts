import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const source = await readFile(resolve("scripts/verify-staging-object-storage.ts"), "utf8");

assert.match(source, /IB_STORAGE_TARGET/);
assert.match(source, /YANDEX_STORAGE_BUCKET/);
assert.match(source, /IB_STAGING_STORAGE_BUCKET/);
assert.match(source, /YANDEX_STORAGE_ACCESS_KEY_ID/);
assert.match(source, /IB_STAGING_STORAGE_ACCESS_KEY_ID/);
assert.match(
  source,
  /YANDEX_STORAGE_ACCESS_KEY_ID does not match IB_STAGING_STORAGE_ACCESS_KEY_ID/,
);
assert.match(source, /HeadBucketCommand/);
assert.match(source, /GetBucketAclCommand/);
assert.match(source, /GetBucketPolicyCommand/);
assert.match(source, /GetBucketCorsCommand/);
assert.match(source, /Object enumeration\/content operations performed: 0/);

for (const forbidden of [
  "ListObjectsCommand",
  "ListObjectsV2Command",
  "GetObjectCommand",
  "PutObjectCommand",
  "DeleteObjectCommand",
]) {
  assert.doesNotMatch(source, new RegExp(forbidden));
}

assert.doesNotMatch(source, /console\.(?:log|error)\([^\n]*configuredAccessKeyId/);
assert.doesNotMatch(source, /console\.(?:log|error)\([^\n]*expectedAccessKeyId/);

console.log("STAGING_STORAGE_VERIFIER_CONTRACT_PASS");
