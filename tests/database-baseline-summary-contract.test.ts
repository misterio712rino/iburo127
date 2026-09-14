import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const summarySource = await readFile(
  resolve("scripts/inspect-database-baseline-summary.ts"),
  "utf8",
);
const fullSource = await readFile(
  resolve("scripts/inspect-database-baseline.ts"),
  "utf8",
);

const summaryGuardIndex = summarySource.indexOf("requireStagingDatabaseTarget()");
const summaryPoolIndex = summarySource.indexOf("new Pool(");
assert.ok(summaryGuardIndex >= 0, "summary inspector must resolve guarded staging target");
assert.ok(summaryPoolIndex > summaryGuardIndex, "target guard must run before database Pool creation");

assert.match(summarySource, /BEGIN READ ONLY/);
assert.match(summarySource, /ROLLBACK/);
assert.match(summarySource, /IB_STAGING_BETTER_AUTH_SCHEMA/);
assert.match(summarySource, /classifyStagingBaseline/);
assert.match(summarySource, /DATABASE_BASELINE_SUMMARY_PASS/);
assert.match(summarySource, /targetVerified:\s*true/);
assert.doesNotMatch(summarySource, /structuralSnapshot/);
assert.doesNotMatch(summarySource, /index_definition/);
assert.doesNotMatch(summarySource, /column_default/);
assert.doesNotMatch(summarySource, /console\.log\([^\n]*(?:databaseUrl|expectedHost|expectedDatabaseName|expectedUser)/);
assert.doesNotMatch(summarySource, /select\s+\*\s+from/i);

assert.match(fullSource, /process\.env\.GITHUB_ACTIONS === "true"/);
assert.match(
  fullSource,
  /full structural baseline output is prohibited in GitHub Actions; use db:inspect:baseline:summary instead/,
);
const fullCiGuardIndex = fullSource.indexOf('process.env.GITHUB_ACTIONS === "true"');
const fullTargetIndex = fullSource.indexOf("requireStagingDatabaseTarget()");
const fullPoolIndex = fullSource.indexOf("new Pool(");
assert.ok(fullCiGuardIndex >= 0 && fullCiGuardIndex < fullTargetIndex);
assert.ok(fullTargetIndex >= 0 && fullTargetIndex < fullPoolIndex);

console.log("DATABASE_BASELINE_SUMMARY_CONTRACT_PASS");
