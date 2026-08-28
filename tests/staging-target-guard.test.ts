import assert from "node:assert/strict";
import { requireStagingDatabaseTarget } from "@/scripts/staging-target-guard";

const baseEnv: NodeJS.ProcessEnv = {
  IB_DB_TARGET: "staging",
  IB_STAGING_DATABASE_NAME: "iburo_staging",
  IB_STAGING_DATABASE_HOST: "staging.pg.example.net",
  IB_STAGING_DATABASE_USER: "iburo_staging_user",
  DATABASE_URL: "postgresql://iburo_staging_user:secret@staging.pg.example.net:6432/iburo_staging?sslmode=require",
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

console.log("STAGING_TARGET_GUARD_TEST_PASS");
