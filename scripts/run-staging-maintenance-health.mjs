import { pathToFileURL } from "node:url";

import { runMaintenanceJob } from "./run-maintenance-job.mjs";

const HEALTH_JOBS = Object.freeze([
  "notification-delivery-health",
  "stale-upload-health",
  "file-scan-health",
  "file-deletion-health",
  "ai-audit-health",
]);

function fail(message) {
  throw new Error(`STAGING_MAINTENANCE_HEALTH_FAIL:${message}`);
}

export async function runStagingMaintenanceHealth({
  env = process.env,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (env.IB_RUNTIME_TARGET?.trim() !== "staging") {
    fail('IB_RUNTIME_TARGET must be exactly "staging"');
  }

  const results = [];
  for (const job of HEALTH_JOBS) {
    results.push(await runMaintenanceJob({ job, env, fetchImpl }));
  }
  return results;
}

async function main() {
  try {
    const results = await runStagingMaintenanceHealth();
    console.log(`STAGING_MAINTENANCE_HEALTH_PASS jobs=${results.length}`);
  } catch (error) {
    console.error(
      error instanceof Error
        ? error.message
        : "STAGING_MAINTENANCE_HEALTH_FAIL:unknown failure",
    );
    process.exitCode = 1;
  }
}

const invokedAsScript = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

if (invokedAsScript) {
  await main();
}
