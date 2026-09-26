import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const workflow = readFileSync(
  resolve(process.cwd(), ".github/workflows/staging-one-file-scan.yml"),
  "utf8",
);

assert.match(workflow, /name: Staging One File Scan/);
assert.match(workflow, /workflow_dispatch:/);
assert.doesNotMatch(workflow, /^\s*schedule:/m);
assert.doesNotMatch(workflow, /^\s*push:/m);
assert.match(workflow, /permissions:\s*\n\s+contents: read/);
assert.doesNotMatch(workflow, /contents:\s*write/);
assert.doesNotMatch(workflow, /id-token:\s*write/);
assert.match(workflow, /github\.ref_name == 'audit\/production-readiness'/);
assert.match(workflow, /RUN_STAGING_ONE_FILE_SCAN/);
assert.match(workflow, /EXPECTED_PENDING: "43"/);
assert.match(workflow, /b\?\.backlog\?\.scanning !== 0/);
assert.match(workflow, /b\?\.backlog\?\.expiredScanning !== 0/);
assert.match(workflow, /b\?\.backlog\?\.noActiveScans !== true/);
assert.match(workflow, /b\?\.candidate\?\.ready !== true/);
assert.match(workflow, /b\?\.worker\?\.batchLimit !== 1/);
assert.match(workflow, /standardMaintenanceEndpointConfigured !== true/);
assert.match(workflow, /Authorization: Bearer \$IB_MAINTENANCE_SECRET/);
assert.match(workflow, /d\.claimed !== 1/);
assert.match(workflow, /d\.failed !== 0/);
assert.match(workflow, /d\.leaseLost !== 0/);
assert.match(workflow, /d\.clean \+ d\.quarantined \+ d\.retried !== 1/);
assert.match(workflow, /expectedPending = terminal \? expected - 1 : expected/);
assert.match(workflow, /expectedAttempted = terminal \? 0 : 1/);

const workerCalls = workflow.match(/\/api\/internal\/maintenance\/file-scans/g) ?? [];
assert.equal(workerCalls.length, 1, "workflow must invoke the real scan worker exactly once");

assert.doesNotMatch(workflow, /IB_FILE_SCAN_SCHEDULER_ENABLED/);
assert.doesNotMatch(workflow, /IB_MAINTENANCE_PRODUCTION_CONFIRM/);
assert.doesNotMatch(workflow, /echo\s+.*IB_MAINTENANCE_SECRET/);
assert.doesNotMatch(workflow, /set\s+-x/);

console.log("STAGING_ONE_FILE_SCAN_WORKFLOW_CONTRACT_PASS");
