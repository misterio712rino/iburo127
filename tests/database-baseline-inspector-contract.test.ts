import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const source = await readFile(resolve("scripts/inspect-database-baseline.ts"), "utf8");

const guardCallIndex = source.indexOf("requireStagingDatabaseTarget()");
const poolCreationIndex = source.indexOf("new Pool({");
const readOnlyTransactionIndex = source.indexOf('client.query("BEGIN READ ONLY")');

assert.ok(guardCallIndex >= 0, "baseline inspector must call requireStagingDatabaseTarget()");
assert.ok(poolCreationIndex >= 0, "baseline inspector must construct a PostgreSQL Pool");
assert.ok(
  guardCallIndex < poolCreationIndex,
  "staging target validation must happen before PostgreSQL Pool construction",
);
assert.ok(
  readOnlyTransactionIndex > poolCreationIndex,
  "baseline inspection must run inside an explicit read-only transaction",
);
assert.match(
  source,
  /databaseIdentity\.database_name !== target\.expectedDatabaseName/,
  "connected database identity must be verified",
);
assert.match(
  source,
  /databaseIdentity\.database_user !== target\.expectedUser/,
  "connected database user must be verified",
);

console.log("DATABASE_BASELINE_INSPECTOR_CONTRACT_TEST_PASS");
