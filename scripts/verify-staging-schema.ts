import "dotenv/config";

import { requireStagingDatabaseTarget } from "./staging-target-guard";
import { verifyStagingDatabaseSchema } from "./staging-schema-verifier";

function fail(message: string): never {
  console.error(`STAGING_SCHEMA_VERIFY_FAIL: ${message}`);
  process.exit(1);
}

let target: ReturnType<typeof requireStagingDatabaseTarget>;
try {
  target = requireStagingDatabaseTarget();
} catch (error) {
  fail(error instanceof Error ? error.message : "invalid staging database target");
}

let report;
try {
  report = await verifyStagingDatabaseSchema(target);
} catch (error) {
  fail(error instanceof Error ? error.message : "staging schema contract failed");
}

console.log(`Staging database identity verified: ${report.databaseName}`);
console.log(`Staging database user verified: ${report.databaseUser}`);
console.log(`Required domain tables verified: ${report.requiredTableCount}`);
console.log(`Required PostgreSQL enums verified: ${report.requiredEnumCount}`);
console.log(
  `StoredFile scan columns verified: ${report.requiredStoredFileScanColumnCount}`,
);
console.log(
  `StoredFileStatus lifecycle values verified: ${report.requiredStoredFileStatusValueCount}`,
);
console.log(`Applied Prisma migrations verified: ${report.appliedMigrationCount}`);
console.log("STAGING_SCHEMA_VERIFY_PASS");
