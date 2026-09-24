import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildProviderAwareStagingStorageReadiness } from "../scripts/staging-storage-readiness";

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
assert.match(source, /createOidcScopedScannerSmokeStorage/);
assert.match(source, /readBoundedScannerJson/);
assert.match(source, /STAGING_SCANNER_BRIDGE_URL/);
assert.match(source, /const maxAttempts = payload\.operation === "scan" \? 1 : BRIDGE_MAX_ATTEMPTS;/);
assert.match(source, /RUN_STAGING_SCANNER_BRIDGE:\$\{commitSha\}:\$\{fingerprint\}/);
assert.match(source, /x-vercel-protection-bypass/);
assert.match(source, /x-iburo-staging-control/);
assert.match(source, /x-iburo-staging-scanner-control/);
assert.match(source, /x-iburo-staging-scanner-secret-sha256/);
assert.doesNotMatch(source, /readVercelBlobAuthConfig|createVercelBlobSignedUrlDriver|BLOB_READ_WRITE_TOKEN/);

assert.match(source, /createPrivateUploadUrl/);
assert.match(source, /createPrivateDownloadUrl/);
assert.match(source, /statPrivateBlob/);
assert.match(source, /deletePrivateBlob/);
assert.match(source, /verifyVercelBlobTargetBeforeMutation/);
assert.match(source, /assertStagingScannerFixtureKeysAbsent/);
assert.match(source, /recordConfirmedUpload\(objectKey\)/);
assert.match(source, /const confirmedUploads: string\[\] = \[\]/);
assert.match(source, /parsed\.hostname\.toLowerCase\(\) !== target\.expectedPrivateBlobHost/);
assert.match(source, /VERCEL_BLOB_PRIVATE_HOST_MISMATCH/);
assert.match(source, /runVercelSmokePhase\("CLEAN",[\s\S]*verifyVercelFixture\([\s\S]*"CLEAN",[\s\S]*target\.cleanObjectKey/);
assert.match(source, /runVercelSmokePhase\("MALICIOUS",[\s\S]*verifyVercelFixture\([\s\S]*"MALICIOUS",[\s\S]*target\.maliciousObjectKey/);
assert.match(source, /await runVercelSmokePhase\("CLEANUP",[\s\S]*cleanupVercelFixtures\(storage, confirmedUploads\)/);
assert.match(source, /VERCEL_BLOB_FIXTURE_CLEANUP_FAILED/);
assert.match(source, /let primaryError: unknown = null;/);
assert.match(source, /if \(primaryError\) throw primaryError;/);
assert.match(source, /attempt < 7/);
assert.match(source, /setTimeout\(resolve, 10_000\)/);
assert.match(source, /FIXTURE_URL_TTL_SECONDS = 300/);
assert.match(source, /MAX_FIXTURE_BYTES = 1024;/);
assert.match(source, /Vercel Blob staging host verified before fixture mutation/);
assert.match(source, /Fixture object keys or signed URLs logged: 0/);
assert.match(source, /STAGING_FILE_SCANNER_VERIFY_PASS/);

const vercelFixtureFunction = source.match(
  /async function verifyVercelBlobFixtures[\s\S]*?(?=\nasync function verifyYandexFixtures)/,
)?.[0];
assert.ok(vercelFixtureFunction, "Vercel Blob scanner fixture function must exist");
const healthIndex = vercelFixtureFunction.indexOf('runVercelSmokePhase("BRIDGE_HEALTH"');
const storageIndex = vercelFixtureFunction.indexOf("const storage = createVercelBlobSmokeStorage();");
assert.ok(healthIndex >= 0 && storageIndex > healthIndex,
  "Vercel-routed authorized staging health must pass before any signed Blob capability or fixture operation");
const preflightIndex = vercelFixtureFunction.indexOf(
  "await verifyVercelBlobTargetBeforeMutation(target, storage);",
);
const absentIndex = vercelFixtureFunction.indexOf("await assertStagingScannerFixtureKeysAbsent(");
const recordCallbackIndex = vercelFixtureFunction.indexOf("const recordConfirmedUpload =");
const mutationTryIndex = vercelFixtureFunction.indexOf("try {", preflightIndex);
const firstCleanupIndex = vercelFixtureFunction.indexOf(
  'runVercelSmokePhase("CLEANUP"',
);
assert.ok(preflightIndex >= 0, "private Blob target preflight must execute");
assert.ok(absentIndex > preflightIndex, "occupied fixtures must fail before uploads or deletions");
assert.ok(recordCallbackIndex > absentIndex, "only post-preflight confirmed uploads may become cleanup targets");
assert.ok(
  mutationTryIndex > preflightIndex,
  "private Blob target preflight must execute before the mutation/cleanup try-finally block",
);
assert.ok(
  firstCleanupIndex > recordCallbackIndex,
  "private Blob target preflight must execute before any fixture cleanup mutation",
);

const fixtureVerificationFunction = source.match(
  /async function verifyVercelFixture[\s\S]*?(?=\nasync function cleanupVercelFixtures)/,
)?.[0];
assert.ok(fixtureVerificationFunction, "Vercel fixture verification function must exist");
for (const step of ["METADATA", "DOWNLOAD_URL", "SCAN"]) {
  assert.match(
    fixtureVerificationFunction,
    new RegExp(`runVercelFixtureStep\\(phase, "${step}"`),
    `fixture verification must classify ${step} without exposing URLs or keys`,
  );
}
assert.match(source, /runVercelFixtureStep\(phase, "UPLOAD_URL"/);
assert.match(source, /runVercelFixtureStep\(phase, "UPLOAD_HTTP"/);
assert.match(source, /VERCEL_FIXTURE_STEP_PATTERN/);
assert.match(source, /VERCEL_UPLOAD_HTTP_PATTERN/);
assert.ok(source.includes("STAGING_SCANNER_UPLOAD_${phase}_NETWORK"));
assert.ok(source.includes("STAGING_SCANNER_UPLOAD_${phase}_HTTP_${status}"));
assert.match(source, /\[400, 401, 403, 404, 409, 413, 415, 429, 500, 502, 503, 504\]\.includes\(response\.status\)/);
assert.match(
  source,
  /STAGING_SCANNER_STEP_\$\{phase\}_\$\{step\}/,
  "fixture step diagnostics must remain fixed and phase-bounded",
);

const uploadFixtureFunction = source.match(
  /async function uploadVercelFixture[\s\S]*?(?=\nasync function verifyVercelFixture)/,
)?.[0];
assert.ok(uploadFixtureFunction, "upload function must exist");
assert.match(uploadFixtureFunction, /fetch\(uploadGrant\.url,\s*\{[\s\S]*?method:\s*"PUT",\s*redirect:\s*"error",/, "signed fixture PUT must not follow redirects");
assert.ok(uploadFixtureFunction.includes("readPresignedBlobStoreId(url, objectKey)"));
for (const header of [
  "x-api-blob-request-id",
  "x-vercel-blob-store-id",
  "x-api-blob-request-attempt",
  "x-api-version",
  "x-vercel-blob-access",
  "x-content-type",
  "x-add-random-suffix",
  "x-allow-overwrite",
]) {
  assert.ok(
    uploadFixtureFunction.includes(header),
    `presigned PUT must include Vercel Blob SDK header ${header}`,
  );
}
assert.ok(source.includes('payload.operations.includes("put")'));
assert.ok(source.includes("payload.pathname !== objectKey"));
assert.ok(source.includes('requireSecretEnv("IB_STAGING_VERCEL_BLOB_PRIVATE_HOST")'));
assert.doesNotMatch(source, /x-vercel-blob-store-id":\s*"[^"]+"/);
const uploadGuardIndex = uploadFixtureFunction.indexOf(
  "if (!response.ok) {",
);
const ownershipIndex = uploadFixtureFunction.indexOf("storage.confirmUploadedFixture(objectKey);");
const confirmUploadIndex = uploadFixtureFunction.indexOf("recordConfirmedUpload(objectKey);");
assert.ok(uploadGuardIndex >= 0 && ownershipIndex > uploadGuardIndex && confirmUploadIndex > ownershipIndex,
  "only acknowledged uploads may authorize ETag-bound cleanup");
assert.doesNotMatch(vercelFixtureFunction, /attemptedKeys\.push/);

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
assert.doesNotMatch(source, /response\.text\(\)|response\.json\(\)/);
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
// Dispatch inputs must never redirect a staging scanner bearer credential to an arbitrary host.
assert.match(smokeWorkflow, /REQUESTED_SCANNER_ORIGIN: \$\{\{ inputs\.scanner_origin \}\}/);
assert.match(smokeWorkflow, /if \[ "\$REQUESTED_SCANNER_ORIGIN" != "https:\/\/scanner-v2-staging\.iburo127\.online" \]; then/);
assert.match(smokeWorkflow, /IB_FILE_SCANNER_ORIGIN: https:\/\/scanner-v2-staging\.iburo127\.online/);
assert.match(smokeWorkflow, /IB_STAGING_FILE_SCANNER_ORIGIN: https:\/\/scanner-v2-staging\.iburo127\.online/);
assert.doesNotMatch(smokeWorkflow, /IB_(?:STAGING_)?FILE_SCANNER_ORIGIN: \$\{\{ inputs\.scanner_origin \}\}/);
const scannerOriginGate = smokeWorkflow.indexOf('if [ "$REQUESTED_SCANNER_ORIGIN" != "https://scanner-v2-staging.iburo127.online" ]; then');
const previewSecretStep = smokeWorkflow.indexOf('VERCEL_AUTOMATION_BYPASS_SECRET: ${{ secrets.VERCEL_AUTOMATION_BYPASS_SECRET }}');
assert.ok(scannerOriginGate > 0 && scannerOriginGate < previewSecretStep, "scanner origin must be pinned before any credential-bearing step");
assert.match(smokeWorkflow, /refs\/heads\/audit\/production-readiness/);
assert.match(smokeWorkflow, /test -n "\$ACTIONS_ID_TOKEN_REQUEST_TOKEN"/);
assert.match(smokeWorkflow, /test -n "\$IB_FILE_SCANNER_SECRET"/);
assert.doesNotMatch(smokeWorkflow, /IB_STAGING_BLOB_READ_WRITE_TOKEN|BLOB_READ_WRITE_TOKEN/);
assert.match(smokeWorkflow, /id-token: write/);
assert.match(smokeWorkflow, /IB_STAGING_SCANNER_FIXTURE_AUTH_MODE: github-oidc/);
assert.match(smokeWorkflow, /secrets\.IB_STAGING_FILE_SCANNER_SECRET/);
assert.match(
  smokeWorkflow,
  /_iburo\/staging-scanner-bridge/,
  "authorized health gate must use the exact protected Preview scanner bridge",
);
assert.match(smokeWorkflow, /RUN_STAGING_SCANNER_BRIDGE:\$\{commitSha\}:\$\{fingerprint\}/);
assert.match(smokeWorkflow, /x-vercel-protection-bypass/);
assert.match(smokeWorkflow, /x-iburo-staging-control/);
assert.match(smokeWorkflow, /x-iburo-staging-scanner-control/);
assert.match(smokeWorkflow, /x-iburo-staging-scanner-secret-sha256/);
assert.match(smokeWorkflow, /x-iburo-staging-scanner-bridge-diagnostic/);
assert.match(
  smokeWorkflow,
  /\^\(CONFIG\|ORIGIN\|FINGERPRINT\|CONTROL\|REQUEST\|UPSTREAM\|UPSTREAM_NETWORK\|UPSTREAM_DNS\|UPSTREAM_CONNECT_TIMEOUT\|UPSTREAM_REFUSED\|UPSTREAM_RESET\|UPSTREAM_ROUTE\|UPSTREAM_TLS\|UPSTREAM_TIMEOUT\|UPSTREAM_HTTP\|UPSTREAM_FORMAT\|UPSTREAM_BODY\)\$/,
  "bridge diagnostic propagation must stay constrained to a fixed allowlist",
);
assert.match(smokeWorkflow, /STAGING_SCANNER_AUTH_HEALTH_DIAGNOSTIC=\$\{reason\}/);
assert.match(smokeWorkflow, /readBoundedScannerJson\(response, 512\)/);
assert.match(smokeWorkflow, /IB_STAGING_VERCEL_BLOB_PRIVATE_HOST: \$\{\{ inputs\.blob_private_host \}\}/);
assert.match(smokeWorkflow, /security-fixtures\/file-scanner\/\$GITHUB_SHA\/\$GITHUB_RUN_ID-\$GITHUB_RUN_ATTEMPT\/clean\.txt/);
assert.match(smokeWorkflow, /security-fixtures\/file-scanner\/\$GITHUB_SHA\/\$GITHUB_RUN_ID-\$GITHUB_RUN_ATTEMPT\/eicar\.txt/);
assert.match(smokeWorkflow, /npm run check:staging:file-scanner/);
assert.match(smokeWorkflow, /_iburo\/staging-identity/);
// Protected Preview identity response must never consume unbounded network/disk resources.
const identityCurl = smokeWorkflow.match(/curl --silent --show-error[^\r\n]+/)?.[0];
assert.ok(identityCurl, "protected Preview identity curl must be present");
assert.match(identityCurl, /--connect-timeout 5/);
assert.match(identityCurl, /--max-time 12/);
assert.match(identityCurl, /--max-filesize 4096/);
assert.doesNotMatch(identityCurl, /--location(?:\s|$)/);
assert.doesNotMatch(smokeWorkflow, /secrets\.BLOB_READ_WRITE_TOKEN/);
assert.doesNotMatch(smokeWorkflow, /secrets\.IB_FILE_SCANNER_SECRET(?![A-Z_])/);
assert.doesNotMatch(smokeWorkflow, /terraform\s+(apply|destroy)|\byc\s|kubectl|vercel\s+(deploy|promote)|target:\s*production/i);
assert.doesNotMatch(smokeWorkflow, /(^|\.)iburo127\.ru(?:\s|\/|$)/i);

const readinessFingerprint = "a".repeat(64);
const readinessSecret = "scanner-readiness-secret-" + "x".repeat(24);
const scannerReadinessCore = {
  IB_RUNTIME_TARGET: "staging",
  IB_FILE_SCANNER_TARGET: "staging",
  IB_STORAGE_TARGET: "staging",
  IB_FILE_SCANNER_ORIGIN: "https://scanner-staging.iburo.test",
  IB_STAGING_FILE_SCANNER_ORIGIN: "https://scanner-staging.iburo.test",
  IB_FILE_SCANNER_SECRET: readinessSecret,
  IB_STAGING_FILE_SCANNER_SECRET_SHA256: readinessFingerprint,
  IB_STAGING_FILE_SCANNER_CLEAN_OBJECT_KEY: "security-fixtures/file-scanner/clean.txt",
  IB_STAGING_FILE_SCANNER_MALICIOUS_OBJECT_KEY: "security-fixtures/file-scanner/eicar.txt",
} as const;

const vercelReadinessEnv = {
  ...scannerReadinessCore,
  VERCEL_ENV: "preview",
  VERCEL_GIT_COMMIT_REF: "audit/production-readiness",
  BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_stagingstore123_secret",
  IB_STAGING_VERCEL_BLOB_PRIVATE_HOST: "stagingstore123.private.blob.vercel-storage.com",
  IB_STAGING_FILE_SCANNER_CONFIRM: `FILE-SCANNER-SMOKE:scanner-staging.iburo.test:vercel-blob:${readinessFingerprint}`,
} as const;

const vercelReadiness = buildProviderAwareStagingStorageReadiness(vercelReadinessEnv).scanner;
assert.equal(vercelReadiness.ready, true);
assert.equal(vercelReadiness.provider, "vercel-blob");
assert.deepEqual(vercelReadiness.missingOrPlaceholder, []);
assert.deepEqual(vercelReadiness.invalidOrInconsistent, []);

const missingPrivateHost = buildProviderAwareStagingStorageReadiness({
  ...vercelReadinessEnv,
  IB_STAGING_VERCEL_BLOB_PRIVATE_HOST: undefined,
}).scanner;
assert.equal(missingPrivateHost.ready, false);
assert.ok(
  missingPrivateHost.missingOrPlaceholder.includes("IB_STAGING_VERCEL_BLOB_PRIVATE_HOST"),
);

const invalidPrivateHost = buildProviderAwareStagingStorageReadiness({
  ...vercelReadinessEnv,
  IB_STAGING_VERCEL_BLOB_PRIVATE_HOST: "https://stagingstore123.private.blob.vercel-storage.com",
}).scanner;
assert.equal(invalidPrivateHost.ready, false);
assert.ok(
  invalidPrivateHost.invalidOrInconsistent.includes("IB_STAGING_VERCEL_BLOB_PRIVATE_HOST"),
);

for (const invalidOrigin of [
  "https://scanner-stage.iburo.test",
  "https://scanner-prod-staging.iburo.test",
  "https://scanner-staging.iburo127.ru",
  "https://scanner-staging.iburo.test:8443",
]) {
  const invalidOriginReadiness = buildProviderAwareStagingStorageReadiness({
    ...vercelReadinessEnv,
    IB_FILE_SCANNER_ORIGIN: invalidOrigin,
    IB_STAGING_FILE_SCANNER_ORIGIN: invalidOrigin,
  }).scanner;
  assert.equal(invalidOriginReadiness.ready, false, `${invalidOrigin} must not be scanner-ready`);
  assert.ok(invalidOriginReadiness.invalidOrInconsistent.includes("IB_FILE_SCANNER_ORIGIN"));
  assert.ok(
    invalidOriginReadiness.invalidOrInconsistent.includes("IB_STAGING_FILE_SCANNER_ORIGIN"),
  );
}

const yandexReadiness = buildProviderAwareStagingStorageReadiness({
  ...scannerReadinessCore,
  IB_OBJECT_STORAGE_PROVIDER: "yandex-object-storage",
  YANDEX_STORAGE_BUCKET: "iburo-staging-scanner-fixtures",
  IB_STAGING_STORAGE_BUCKET: "iburo-staging-scanner-fixtures",
  YANDEX_STORAGE_ACCESS_KEY_ID: "staging-storage-key-id",
  IB_STAGING_STORAGE_ACCESS_KEY_ID: "staging-storage-key-id",
  YANDEX_STORAGE_SECRET_ACCESS_KEY: "staging-storage-secret-that-must-not-print",
  IB_STAGING_FILE_SCANNER_CONFIRM: `FILE-SCANNER-SMOKE:scanner-staging.iburo.test:iburo-staging-scanner-fixtures:${readinessFingerprint}`,
}).scanner;
assert.equal(yandexReadiness.ready, true);
assert.equal(yandexReadiness.provider, "yandex-object-storage");
assert.equal(
  yandexReadiness.missingOrPlaceholder.includes("IB_STAGING_VERCEL_BLOB_PRIVATE_HOST"),
  false,
  "Yandex scanner readiness must not require the Vercel-only private Blob host",
);

console.log("STAGING_FILE_SCANNER_VERIFIER_CONTRACT_PASS");
