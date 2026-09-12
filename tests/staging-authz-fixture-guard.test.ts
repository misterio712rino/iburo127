import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { requireStagingAuthzFixtures } from "@/scripts/staging-authz-fixture-guard";

const baseEnv = {
  IB_STAGING_CLIENT_USER_ID: "11111111-1111-4111-8111-111111111111",
  IB_STAGING_CLIENT_SUBJECT: "better-auth-client-subject",
  IB_STAGING_LAWYER_USER_ID: "22222222-2222-4222-8222-222222222222",
  IB_STAGING_LAWYER_SUBJECT: "better-auth-lawyer-subject",
  IB_STAGING_MANAGER_USER_ID: "33333333-3333-4333-8333-333333333333",
  IB_STAGING_MANAGER_SUBJECT: "better-auth-manager-subject",
} as const;

const fixtures = requireStagingAuthzFixtures(baseEnv);
assert.equal(fixtures.length, 3);
assert.deepEqual(
  fixtures.map((fixture) => fixture.requiredRole),
  ["CLIENT", "LAWYER", "MANAGER"],
);

for (const name of [
  "IB_STAGING_CLIENT_USER_ID",
  "IB_STAGING_LAWYER_USER_ID",
  "IB_STAGING_MANAGER_USER_ID",
] as const) {
  assert.throws(
    () => requireStagingAuthzFixtures({ ...baseEnv, [name]: "not-a-uuid" }),
    new RegExp(name),
  );
}

assert.throws(
  () =>
    requireStagingAuthzFixtures({
      ...baseEnv,
      IB_STAGING_LAWYER_USER_ID: baseEnv.IB_STAGING_CLIENT_USER_ID,
    }),
  /user IDs must be distinct/,
);
assert.throws(
  () =>
    requireStagingAuthzFixtures({
      ...baseEnv,
      IB_STAGING_MANAGER_SUBJECT: baseEnv.IB_STAGING_CLIENT_SUBJECT,
    }),
  /subjects must be distinct/,
);
assert.throws(
  () => requireStagingAuthzFixtures({ ...baseEnv, IB_STAGING_CLIENT_SUBJECT: "bad\nsubject" }),
  /safe opaque subject/,
);
assert.throws(
  () => requireStagingAuthzFixtures({ ...baseEnv, IB_STAGING_CLIENT_SUBJECT: "x".repeat(256) }),
  /safe opaque subject/,
);

const verifierSource = await readFile(resolve("scripts/verify-staging-authz-fixtures.ts"), "utf8");
const targetGuardIndex = verifierSource.indexOf("requireStagingDatabaseTarget()");
const fixtureGuardIndex = verifierSource.indexOf("requireStagingAuthzFixtures()");
const poolIndex = verifierSource.indexOf("new Pool(");
assert.ok(targetGuardIndex >= 0, "authz verifier must validate staging DB identity");
assert.ok(fixtureGuardIndex > targetGuardIndex, "authz fixture guard must run after DB target parsing");
assert.ok(poolIndex > fixtureGuardIndex, "authz fixture identities must be validated before DB client creation");

console.log("STAGING_AUTHZ_FIXTURE_GUARD_TEST_PASS");
