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
