import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(
  resolve(process.cwd(), "app/%5Fiburo/staging-file-scan-worker-preflight/route.ts"),
  "utf8",
);

assert.match(source, /operation: "staging-file-scan-worker-preflight"/);
assert.match(source, /PREFLIGHT_STAGING_FILE_SCAN_WORKER:/);
assert.match(source, /readOnly: true/);
assert.match(source, /networkAccessed: true/);
assert.match(source, /batchIsOne/);
assert.match(source, /leaseTimeoutCompatible/);
assert.match(source, /sourceUrlTtlCompatible/);
assert.match(source, /standardMaintenanceEndpointConfigured/);
assert.match(source, /scanAttemptCount: 0/);
assert.match(source, /scanAttemptCount: \{ gt: 0 \}/);
assert.match(source, /status: "SCANNING"/);
assert.match(source, /expiredScanning/);
assert.match(source, /noActiveScans/);
assert.match(source, /MAX_SCANNER_FILE_BYTES = BigInt\(52_428_800\)/);
assert.match(source, /ALLOWED_SCANNER_MIME_TYPES/);
assert.match(source, /storage\.statObject\(candidate\.objectKey\)/);
assert.match(source, /candidateReady/);
assert.match(source, /httpStatus: health\.httpStatus/);
assert.match(source, /responseErrorCode: health\.responseErrorCode/);
assert.match(source, /function safeScannerResponseErrorCode/);
assert.match(source, /value === "UNAUTHORIZED" \|\| value === "REQUEST_FAILED"/);
assert.doesNotMatch(source, /scanner:\s*\{[\s\S]{0,500}(?:origin|secret)\s*:/);

for (const forbidden of [
  "runBatch(",
  "claimDueScan(",
  "markScanClean(",
  "markScanQuarantined(",
  "markScanFailed(",
  "rescheduleScan(",
  ".delete(",
  ".deleteMany(",
  ".update(",
  ".updateMany(",
  ".create(",
  ".createMany(",
  ".upsert(",
]) {
  assert.equal(source.includes(forbidden), false, `preflight must not contain ${forbidden}`);
}

assert.doesNotMatch(source, /scanner:\s*\{[\s\S]{0,400}secret\s*:/);
assert.doesNotMatch(source, /backlog:\s*\{[\s\S]{0,400}(?:objectKey|fileName|uploadedById|clientCaseId)\s*:/);

console.log("STAGING_FILE_SCAN_WORKER_PREFLIGHT_CONTRACT_PASS");

assert.doesNotMatch(
  source,
  /candidate:\s*\{[\s\S]{0,700}(?:objectKey|fileName|uploadedById|clientCaseId)\s*:/,
);
