import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const route = readFileSync(
  resolve(root, "app/%5Fiburo/staging-maintenance-technical-fixture-cleanup/route.ts"),
  "utf8",
);
const workflow = readFileSync(
  resolve(root, ".github/workflows/staging-technical-maintenance-fixture-cleanup.yml"),
  "utf8",
);

assert.match(route, /status: "PENDING_UPLOAD"/);
assert.match(route, /TECHNICAL_FIXTURE_SNAPSHOT_MISMATCH/);
assert.match(route, /objectKey: \{ startsWith: objectKeyPrefix \}/);
assert.match(route, /restorePending\(file\)/);
assert.match(route, /getStoredFileDeletionWorker\(\)/);
assert.match(route, /fileId: deletion\.fileId/);
assert.match(route, /originalFileStatus: "PENDING_SCAN"/);
assert.doesNotMatch(route, /getStoredFileScanWorker/);

assert.match(workflow, /workflow_dispatch:/);
assert.doesNotMatch(workflow, /\n\s+push:/);
assert.match(workflow, /unknownOrNonTechnical!==0/);
assert.match(workflow, /CLEAN_TECHNICAL_MAINTENANCE_FIXTURES/);
assert.match(workflow, /staleUploads\?\.overdue!==0/);
assert.match(workflow, /fileDeletion\?\.overduePending!==0/);

console.log("staging technical maintenance cleanup contract: PASS");
