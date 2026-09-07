import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const workflow = await readFile(
  resolve(".github/workflows/file-scan-maintenance-scheduler.yml"),
  "utf8",
);

assert.match(workflow, /cron: "\*\/5 \* \* \* \*"/);
assert.match(workflow, /^permissions:\n\s{2}contents: read$/m);
assert.match(workflow, /^  file-scans:$/m);
assert.match(workflow, /^  file-scan-health:$/m);
assert.doesNotMatch(
  workflow,
  /^\s+needs:/m,
  "file scan health must execute independently from worker success/failure",
);
assert.equal(
  [...workflow.matchAll(/if: vars\.IB_FILE_SCAN_SCHEDULER_ENABLED == 'true' && github\.ref_name == github\.event\.repository\.default_branch/g)].length,
  2,
  "worker and health jobs must each require explicit enablement and the default branch",
);
assert.equal(
  [...workflow.matchAll(/runs-on: ubuntu-24\.04/g)].length,
  2,
  "worker and health jobs must use the pinned runner image",
);
assert.equal(
  [...workflow.matchAll(/persist-credentials: false/g)].length,
  2,
  "each independent scheduler checkout must disable credential persistence",
);
assert.equal(
  [...workflow.matchAll(/ref: \$\{\{ github\.event\.pull_request\.head\.sha \|\| github\.sha \}\}/g)].length,
  2,
  "each scheduler job must check out the exact workflow SHA",
);
assert.equal(
  [...workflow.matchAll(/node scripts\/run-maintenance-job\.mjs file-scans/g)].length,
  1,
  "worker must invoke one bounded scan batch per tick",
);
assert.equal(
  [...workflow.matchAll(/node scripts\/run-maintenance-job\.mjs file-scan-health/g)].length,
  1,
  "health must inspect scan backlog once per tick",
);
assert.match(workflow, /IB_MAINTENANCE_FILE_SCAN_TIMEOUT_MS: \$\{\{ vars\.IB_MAINTENANCE_FILE_SCAN_TIMEOUT_MS \}\}/);
assert.match(workflow, /IB_RUNTIME_TARGET: \$\{\{ vars\.IB_MAINTENANCE_RUNTIME_TARGET \}\}/);
assert.match(workflow, /IB_MAINTENANCE_BASE_URL: \$\{\{ vars\.IB_MAINTENANCE_BASE_URL \}\}/);
assert.match(workflow, /BETTER_AUTH_URL: \$\{\{ vars\.IB_MAINTENANCE_BETTER_AUTH_URL \}\}/);
assert.match(workflow, /IB_STAGING_BASE_URL: \$\{\{ vars\.IB_STAGING_BASE_URL \}\}/);
assert.match(workflow, /IB_MAINTENANCE_PRODUCTION_CONFIRM: \$\{\{ vars\.IB_MAINTENANCE_PRODUCTION_CONFIRM \}\}/);
assert.match(workflow, /IB_MAINTENANCE_SECRET: \$\{\{ secrets\.IB_MAINTENANCE_SECRET \}\}/);
assert.doesNotMatch(
  workflow,
  /https?:\/\//,
  "file scan scheduler must not hard-code a staging or production endpoint",
);
assert.doesNotMatch(
  workflow,
  /PRODUCTION:https?:\/\//,
  "file scan scheduler must not embed a production confirmation value",
);

console.log("FILE_SCAN_MAINTENANCE_SCHEDULER_CONTRACT_PASS");
