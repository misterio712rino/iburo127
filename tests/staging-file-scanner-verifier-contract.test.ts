import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const source = await readFile(resolve("scripts/verify-staging-file-scanner.ts"), "utf8");
const cloudInit = await readFile(
  resolve("infra/file-scanner-staging/cloud-init.yaml.tftpl"),
  "utf8",
);
const compose = await readFile(
  resolve("services/file-scanner/deploy/docker-compose.staging.yml"),
  "utf8",
);
const smokeWorkflow = await readFile(
  resolve(".github/workflows/staging-file-scanner-smoke.yml"),
  "utf8",
);

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
assert.match(source, /verifyVercelBlobTargetBeforeMutation/);
assert.match(source, /parsed\.hostname\.toLowerCase\(\) !== target\.expectedPrivateBlobHost/);
assert.match(source, /VERCEL_BLOB_PRIVATE_HOST_MISMATCH/);
assert.match(source, /await verifyVercelFixture\([\s\S]*target\.cleanObjectKey,[\s\S]*"CLEAN"/);
assert.match(source, /await verifyVercelFixture\([\s\S]*target\.maliciousObjectKey,[\s\S]*"MALICIOUS"/);
assert.match(source, /finally\s*\{\s*await cleanupVercelFixtures\(storage, target\)/);
assert.match(source, /VERCEL_BLOB_FIXTURE_CLEANUP_FAILED/);
assert.match(source, /FIXTURE_URL_TTL_SECONDS = 300/);
assert.match(source, /MAX_FIXTURE_BYTES = 1024 \* 1024/);
assert.match(source, /Vercel Blob staging host verified before fixture mutation/);
assert.match(source, /Fixture object keys or signed URLs logged: 0/);
assert.match(source, /STAGING_FILE_SCANNER_VERIFY_PASS/);

const vercelFixtureFunction = source.match(
  /async function verifyVercelBlobFixtures[\s\S]*?(?=\nasync function verifyYandexFixtures)/,
)?.[0];
assert.ok(vercelFixtureFunction, "Vercel Blob scanner fixture function must exist");
const preflightIndex = vercelFixtureFunction.indexOf(
  "await verifyVercelBlobTargetBeforeMutation(target, storage);",
);
const mutationTryIndex = vercelFixtureFunction.indexOf("try {", preflightIndex);
const firstCleanupIndex = vercelFixtureFunction.indexOf(
  "await cleanupVercelFixtures(storage, target);",
);
assert.ok(preflightIndex >= 0, "private Blob target preflight must execute");
assert.ok(
  mutationTryIndex > preflightIndex,
  "private Blob target preflight must execute before the mutation/cleanup try-finally block",
);
assert.ok(
  firstCleanupIndex > preflightIndex,
  "private Blob target preflight must execute before any fixture cleanup mutation",
);

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

assert.match(cloudInit, /iburo-file-scanner-metadata-firewall\.service/);
assert.match(cloudInit, /PartOf=docker\.service/);
assert.match(cloudInit, /DOCKER-USER -d 169\.254\.169\.254\/32 -j REJECT/);
assert.match(cloudInit, /systemctl, enable, --now, iburo-file-scanner-metadata-firewall\.service/);
assert.doesNotMatch(cloudInit, /IB_FILE_SCANNER_SECRET=/);

assert.match(compose, /read_only:\s*true/);
assert.match(compose, /cap_drop:\s*\n\s*- ALL/);
assert.match(compose, /cap_add:\s*\n\s*- CHOWN\s*\n\s*- SETGID\s*\n\s*- SETUID/);
assert.match(compose, /\/run\/clamav:rw,nosuid,nodev,noexec,size=16m/);
assert.match(compose, /\/tmp:rw,nosuid,nodev,noexec,size=64m/);
assert.match(compose, /127\.0\.0\.1:8080:8080/);
assert.doesNotMatch(compose, /privileged:\s*true/);
assert.doesNotMatch(compose, /network_mode:\s*host/);
assert.doesNotMatch(compose, /docker\.sock/);

assert.match(smokeWorkflow, /^on:\s*\n\s{2}workflow_dispatch:/m);
assert.doesNotMatch(smokeWorkflow, /^\s{2}(push|pull_request|schedule|workflow_run):/m);
for (const input of [
  "candidate_sha",
  "scanner_origin",
  "blob_private_host",
  "scanner_secret_sha256",
  "confirmation",
]) {
  assert.match(smokeWorkflow, new RegExp(`^\\s{6}${input}:`, "m"));
}
assert.match(smokeWorkflow, /permissions:\s*\n\s{2}contents: read/);
assert.match(smokeWorkflow, /runs-on: ubuntu-24\.04/);
assert.match(smokeWorkflow, /persist-credentials: false/);
assert.match(smokeWorkflow, /ref: \$\{\{ github\.event\.pull_request\.head\.sha \|\| github\.sha \}\}/);
assert.match(smokeWorkflow, /RUN_STAGING_FILE_SCANNER_SMOKE/);
assert.match(smokeWorkflow, /refs\/heads\/audit\/production-readiness/);
assert.match(smokeWorkflow, /test -n "\$BLOB_READ_WRITE_TOKEN"/);
assert.match(smokeWorkflow, /test -n "\$IB_FILE_SCANNER_SECRET"/);
assert.match(smokeWorkflow, /secrets\.IB_STAGING_BLOB_READ_WRITE_TOKEN/);
assert.match(smokeWorkflow, /secrets\.IB_STAGING_FILE_SCANNER_SECRET/);
assert.match(smokeWorkflow, /IB_STAGING_VERCEL_BLOB_PRIVATE_HOST: \$\{\{ inputs\.blob_private_host \}\}/);
assert.match(smokeWorkflow, /security-fixtures\/file-scanner\/\$GITHUB_SHA\/clean\.txt/);
assert.match(smokeWorkflow, /security-fixtures\/file-scanner\/\$GITHUB_SHA\/eicar\.txt/);
assert.match(smokeWorkflow, /npm run check:staging:file-scanner/);
assert.match(smokeWorkflow, /_iburo\/staging-identity/);
assert.doesNotMatch(smokeWorkflow, /secrets\.BLOB_READ_WRITE_TOKEN/);
assert.doesNotMatch(smokeWorkflow, /secrets\.IB_FILE_SCANNER_SECRET(?![A-Z_])/);
assert.doesNotMatch(smokeWorkflow, /terraform\s+(apply|destroy)|\byc\s|kubectl|vercel\s+(deploy|promote)|target:\s*production/i);
assert.doesNotMatch(smokeWorkflow, /(^|\.)iburo127\.ru(?:\s|\/|$)/i);

console.log("STAGING_FILE_SCANNER_VERIFIER_CONTRACT_PASS");
