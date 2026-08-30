import assert from "node:assert/strict";

import { buildStagingEnvironmentInventory } from "../scripts/staging-environment-inventory";

const baseEnv = {
  IB_RUNTIME_TARGET: "staging",
  IB_STAGING_BASE_URL: "https://stage.iburo.test",
  IB_STAGING_AUTH_FLOW_TARGET: "staging",
  IB_STAGING_AUTH_FLOW_CONFIRM: "AUTH-FLOW:stage.iburo.test",
  IB_STAGING_CLIENT_EMAIL: "client@stage.iburo.test",
  IB_STAGING_CLIENT_PASSWORD: "client-password-that-must-never-print",
  IB_STAGING_LAWYER_EMAIL: "lawyer@stage.iburo.test",
  IB_STAGING_LAWYER_PASSWORD: "lawyer-password-that-must-never-print",
  IB_STAGING_LAWYER_TOTP_SECRET: "JBSWY3DPEHPK3PXP",
  IB_STAGING_MANAGER_EMAIL: "manager@stage.iburo.test",
  IB_STAGING_MANAGER_PASSWORD: "manager-password-that-must-never-print",
  IB_STAGING_MANAGER_TOTP_SECRET: "KRSXG5DSNFXGOIDB",
  IB_STAGING_CLIENT_CASE_NUMBER: "STAGE-CLIENT-001",
  IB_STAGING_LAWYER_CASE_NUMBER: "STAGE-LAWYER-001",
  IB_STAGING_CLIENT_AI_CASE_NUMBER: "STAGE-CLIENT-AI-001",
  IB_STAGING_CLIENT_NO_AI_CASE_NUMBER: "STAGE-CLIENT-NOAI-001",
  IB_STAGING_MUTATION_TARGET: "staging",
  IB_STAGING_MUTATION_CONFIRM: "MUTATE:stage.iburo.test",
  IB_STAGING_MUTATION_CASE_NUMBER: "STAGE-MUTATION-001",
  IB_STAGING_MUTATION_TASK_ID: "stage-task-id",
} as const;

for (const timeout of [undefined, "1000", "60000"] as const) {
  const inventory = buildStagingEnvironmentInventory({
    ...baseEnv,
    ...(timeout === undefined ? {} : { IB_STAGING_AUTH_REQUEST_TIMEOUT_MS: timeout }),
  });
  for (const phase of ["authFlow", "applicationE2e"] as const) {
    assert.equal(inventory.phases[phase].ready, true, `${phase}: timeout ${timeout ?? "absent"} must be accepted`);
    assert.deepEqual(inventory.phases[phase].invalidOrInconsistent, []);
  }
}

for (const timeout of ["999", "60001", "1.5", "abc"] as const) {
  const inventory = buildStagingEnvironmentInventory({
    ...baseEnv,
    IB_STAGING_AUTH_REQUEST_TIMEOUT_MS: timeout,
  });
  for (const phase of ["authFlow", "applicationE2e"] as const) {
    assert.equal(inventory.phases[phase].ready, false, `${phase}: timeout ${timeout} must fail closed`);
    assert.ok(
      inventory.phases[phase].invalidOrInconsistent.includes("IB_STAGING_AUTH_REQUEST_TIMEOUT_MS"),
      `${phase}: timeout ${timeout} must be reported by variable name only`,
    );
  }
  assert.equal(JSON.stringify(inventory).includes(timeout), false, "inventory must not expose timeout values");
}

const redactionSentinel = "54321";
const redactedInventory = buildStagingEnvironmentInventory({
  ...baseEnv,
  IB_STAGING_AUTH_REQUEST_TIMEOUT_MS: redactionSentinel,
});
assert.equal(redactedInventory.phases.authFlow.ready, true);
assert.equal(redactedInventory.phases.applicationE2e.ready, true);
assert.equal(JSON.stringify(redactedInventory).includes(redactionSentinel), false);

console.log("STAGING_ENVIRONMENT_AUTH_TIMEOUT_TEST_PASS");
