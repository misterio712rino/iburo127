import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  requireStagingDatabaseTarget,
  requireStagingMutationConfirmation,
} from "@/scripts/staging-target-guard";
import { requireStagingAuthRuntimeTarget } from "@/scripts/staging-http-target-guard";

const stagingDatabaseUrl = [
  "postgresql://",
  "iburo_staging_user",
  ":",
  "fixture-value",
  "@",
  "staging.pg.example.net:6432/iburo_staging?sslmode=require",
].join("");

const baseEnv: Record<string, string | undefined> = {
  IB_DB_TARGET: "staging",
  IB_STAGING_DATABASE_NAME: "iburo_staging",
  IB_STAGING_DATABASE_HOST: "staging.pg.example.net",
  IB_STAGING_DATABASE_USER: "iburo_staging_user",
  DATABASE_URL: stagingDatabaseUrl,
};

assert.deepEqual(requireStagingDatabaseTarget(baseEnv), {
  databaseUrl: baseEnv.DATABASE_URL,
  expectedDatabaseName: "iburo_staging",
  expectedHost: "staging.pg.example.net",
  expectedUser: "iburo_staging_user",
});

assert.throws(
  () => requireStagingDatabaseTarget({ ...baseEnv, IB_DB_TARGET: "production" }),
  /IB_DB_TARGET/,
);
assert.throws(
  () => requireStagingDatabaseTarget({ ...baseEnv, DATABASE_URL: baseEnv.DATABASE_URL!.replace("iburo_staging?", "iburo_prod?") }),
  /IB_STAGING_DATABASE_NAME/,
);
assert.throws(
  () => requireStagingDatabaseTarget({ ...baseEnv, DATABASE_URL: baseEnv.DATABASE_URL!.replace("staging.pg.example.net", "production.pg.example.net") }),
  /IB_STAGING_DATABASE_HOST/,
);
assert.throws(
  () => requireStagingDatabaseTarget({ ...baseEnv, DATABASE_URL: baseEnv.DATABASE_URL!.replace("iburo_staging_user:", "prod_user:") }),
  /IB_STAGING_DATABASE_USER/,
);
assert.throws(
  () => requireStagingDatabaseTarget({ ...baseEnv, DATABASE_URL: "https://staging.pg.example.net/iburo_staging" }),
  /postgresql/,
);

assert.equal(
  requireStagingMutationConfirmation(
    { IB_STAGING_REFERENCE_SEED_CONFIRM: "REFERENCE-SEED:iburo_staging" },
    "IB_STAGING_REFERENCE_SEED_CONFIRM",
    "REFERENCE-SEED",
    "iburo_staging",
  ),
  "REFERENCE-SEED:iburo_staging",
);
assert.throws(
  () =>
    requireStagingMutationConfirmation(
      { IB_STAGING_REFERENCE_SEED_CONFIRM: "REFERENCE-SEED:production" },
      "IB_STAGING_REFERENCE_SEED_CONFIRM",
      "REFERENCE-SEED",
      "iburo_staging",
    ),
  /IB_STAGING_REFERENCE_SEED_CONFIRM/,
);

const authEnv: Record<string, string | undefined> = {
  IB_RUNTIME_TARGET: "staging",
  IB_STAGING_BASE_URL: "https://preview.example.vercel.app",
  BETTER_AUTH_URL: "https://preview.example.vercel.app",
  BETTER_AUTH_SECRET: "s".repeat(32),
};
assert.deepEqual(requireStagingAuthRuntimeTarget(authEnv), {
  baseUrl: "https://preview.example.vercel.app",
  secret: "s".repeat(32),
});
assert.throws(
  () => requireStagingAuthRuntimeTarget({ ...authEnv, IB_RUNTIME_TARGET: "production" }),
  /IB_RUNTIME_TARGET/,
);
assert.throws(
  () => requireStagingAuthRuntimeTarget({ ...authEnv, IB_STAGING_BASE_URL: "https://iburo127.ru", BETTER_AUTH_URL: "https://iburo127.ru" }),
  /production hostname/,
);
assert.throws(
  () => requireStagingAuthRuntimeTarget({ ...authEnv, BETTER_AUTH_URL: "https://other-preview.example.vercel.app" }),
  /must match IB_STAGING_BASE_URL origin/,
);
assert.throws(
  () => requireStagingAuthRuntimeTarget({ ...authEnv, BETTER_AUTH_URL: "https://preview.example.vercel.app/auth" }),
  /must be an origin/,
);
assert.throws(
  () => requireStagingAuthRuntimeTarget({ ...authEnv, BETTER_AUTH_SECRET: "too-short" }),
  /at least 32 characters/,
);

const coreSource = await readFile(resolve("scripts/check-staging-readiness.ts"), "utf8");
const authGuardIndex = coreSource.indexOf("requireStagingAuthRuntimeTarget()");
const poolIndex = coreSource.indexOf("new Pool(");
const passIndex = coreSource.indexOf("STAGING_CORE_READINESS_PASS");
assert.ok(authGuardIndex >= 0, "staging core must verify auth runtime target identity");
assert.ok(poolIndex > authGuardIndex, "staging auth runtime identity must be verified before database network access");
assert.ok(passIndex > poolIndex, "staging core PASS marker must remain after target validation and DB verification");
assert.match(coreSource, /Better Auth runtime config: staging origin identity verified/);

console.log("STAGING_TARGET_GUARD_TEST_PASS");
