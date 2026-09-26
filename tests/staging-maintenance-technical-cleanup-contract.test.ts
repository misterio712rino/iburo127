import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const route = readFileSync(
  resolve(root, "app/%5Fiburo/staging-maintenance-technical-fixture-cleanup/route.ts"),
  "utf8",
);
const workflow = readFileSync(
  resolve(root, ".github/workflows/staging-external-readiness.yml"),
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
assert.match(workflow, /push:\s*\n\s+branches:\s*\n\s+- audit\/production-readiness/);
assert.match(
  workflow,
  /if: github\.event_name == 'workflow_dispatch' && inputs\.confirmation == 'CLEAN_STAGING_TECHNICAL_MAINTENANCE_22_2'/,
);
assert.match(workflow, /EXPECTED_STALE: "22"/);
assert.match(workflow, /EXPECTED_DELETION: "2"/);
assert.match(workflow, /unknownOrNonTechnical !== 0/);
assert.match(workflow, /x-iburo-staging-control: \$VERCEL_AUTOMATION_BYPASS_SECRET/);
assert.match(workflow, /CLEAN_TECHNICAL_MAINTENANCE_FIXTURES:/);
assert.match(workflow, /STAGING_TECHNICAL_MAINTENANCE_POST_CLEANUP_PASS/);

console.log("staging technical maintenance cleanup contract: PASS");
