import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const route = await readFile(
  resolve("app/%5Fiburo/staging-better-auth-upgrade-173/route.ts"),
  "utf8",
);

assert.match(route, /VERCEL_STAGING_BRANCH/);
assert.match(route, /isVercelPreviewBackendAllowed/);
assert.match(route, /IB_RUNTIME_TARGET\?\.trim\(\) === "staging"/);
assert.match(route, /requireStagingDatabaseTarget/);
assert.match(route, /UPGRADE_BETTER_AUTH_173:/);
assert.match(route, /origin !== requestUrl\.origin && secFetchSite !== "same-origin"/);
assert.match(route, /pg_advisory_xact_lock/);
assert.match(route, /iburo127:staging:better-auth:1\.7\.3/);
assert.match(route, /from pg_indexes/);
assert.match(route, /schemaname = \$1/);
assert.match(route, /indexname = \$2/);
assert.match(route, /\[BETTER_AUTH_SCHEMA, LEGACY_INDEX\]/);
assert.match(route, /group by "providerId", "accountId"/);
assert.match(route, /having count\(\*\) > 1/);
assert.match(route, /duplicateProviderAccounts !== 0/);
assert.match(route, /ALTER TABLE "account" ALTER COLUMN "issuer" DROP NOT NULL;/);
assert.match(route, /DROP INDEX "account_issuer_accountId_uidx";/);
assert.match(route, /EXPECTED_SQL_SHA256/);
assert.match(route, /isLegacy173UpgradeBaseline\(baseline\)/);
assert.match(route, /isUpgraded173Baseline\(upgraded\)/);
assert.match(route, /await client\.query\("ROLLBACK"\)/);
assert.match(route, /await client\.query\("COMMIT"\)/);
assert.doesNotMatch(route, /IB_RUNTIME_TARGET.*production/);
assert.doesNotMatch(route, /prisma db push/);
assert.doesNotMatch(route, /migrate.*production/i);

console.log("BETTER_AUTH_173_STAGING_UPGRADE_BOUNDARY_PASS");
