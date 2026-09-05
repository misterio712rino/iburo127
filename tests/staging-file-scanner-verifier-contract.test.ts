import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const source = await readFile(resolve("scripts/verify-staging-file-scanner.ts"), "utf8");

assert.match(source, /assertStagingFileScannerTarget\(process\.env\)/);
assert.match(source, /HeadObjectCommand/);
assert.match(source, /GetObjectCommand/);
assert.match(source, /getSignedUrl/);
assert.match(source, /scanWithHttpMalwareScanner/);
assert.match(source, /target\.providerCode === VERCEL_BLOB_STORAGE_PROVIDER/);
assert.match(source, /createVercelBlobSignedUrlDriver/);
assert.match(source, /createVercelBlobNativeSignedUrlDependencies/);
assert.match(source, /createPrivateUploadUrl/);
assert.match(source, /createPrivateDownloadUrl/);
assert.match(source, /statPrivateBlob/);
assert.match(source, /deletePrivateBlob/);
assert.match(source, /await verifyVercelFixture\([\s\S]*target\.cleanObjectKey,[\s\S]*"CLEAN"/);
assert.match(source, /await verifyVercelFixture\([\s\S]*target\.maliciousObjectKey,[\s\S]*"MALICIOUS"/);
assert.match(source, /finally\s*\{\s*await cleanupVercelFixtures\(storage, target\)/);
assert.match(source, /VERCEL_BLOB_FIXTURE_CLEANUP_FAILED/);
assert.match(source, /FIXTURE_URL_TTL_SECONDS = 300/);
assert.match(source, /MAX_FIXTURE_BYTES = 1024 \* 1024/);
assert.match(source, /Fixture object keys or signed URLs logged: 0/);
assert.match(source, /STAGING_FILE_SCANNER_VERIFY_PASS/);

for (const forbidden of [
  "PutObjectCommand",
  "DeleteObjectCommand",
  "CopyObjectCommand",
  "ListObjectsCommand",
  "ListObjectsV2Command",
  "CreateMultipartUploadCommand",
]) {
  assert.doesNotMatch(source, new RegExp(forbidden));
}

assert.doesNotMatch(source, /console\.(?:log|error)\([^\n]*objectKey/);
assert.doesNotMatch(source, /console\.(?:log|error)\([^\n]*sourceUrl/);
assert.doesNotMatch(source, /console\.(?:log|error)\([^\n]*scannerSecret/);
assert.doesNotMatch(source, /console\.error\(error\)/);
assert.doesNotMatch(source, /String\(error\)/);
assert.doesNotMatch(source, /prisma|ClientCase|DATABASE_URL/i);

console.log("STAGING_FILE_SCANNER_VERIFIER_CONTRACT_PASS");
