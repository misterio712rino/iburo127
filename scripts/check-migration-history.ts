import "dotenv/config";

import {
  assertPinnedMigrationHistory,
  inspectMigrationHistory,
} from "./migration-history-guard";

function fail(message: string): never {
  console.error(`MIGRATION_HISTORY_FAIL: ${message}`);
  process.exit(1);
}

const mode = process.argv[2] ?? "--inspect";
if (mode !== "--inspect" && mode !== "--require-pinned") {
  fail("mode must be --inspect or --require-pinned");
}

let snapshot;
try {
  snapshot = await inspectMigrationHistory();
} catch (error) {
  fail(error instanceof Error ? error.message : "invalid migration history");
}

console.log(`Migration provider: ${snapshot.provider}`);
console.log(`Migration count: ${snapshot.migrationCount}`);
console.log(`Migration history SHA-256: ${snapshot.fingerprint}`);
for (const migration of snapshot.migrations) {
  console.log(`Migration: ${migration.name} sql_sha256=${migration.sqlSha256} bytes=${migration.bytes}`);
}

if (mode === "--require-pinned") {
  try {
    assertPinnedMigrationHistory(snapshot, process.env.IB_STAGING_MIGRATION_HISTORY_SHA256);
  } catch (error) {
    fail(error instanceof Error ? error.message : "migration history fingerprint is not pinned");
  }
  console.log("MIGRATION_HISTORY_PIN_PASS");
} else {
  console.log("MIGRATION_HISTORY_INSPECT_PASS");
}
