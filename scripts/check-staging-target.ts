import "dotenv/config";

import { requireStagingDatabaseTarget } from "./staging-target-guard";

try {
  const target = requireStagingDatabaseTarget();
  console.log(`Staging database URL identity preflight passed: ${target.expectedDatabaseName}`);
  console.log("STAGING_TARGET_GUARD_PASS");
} catch (error) {
  const message = error instanceof Error ? error.message : "invalid staging database target";
  console.error(`STAGING_TARGET_GUARD_FAIL: ${message}`);
  process.exit(1);
}
