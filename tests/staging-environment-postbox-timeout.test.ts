import assert from "node:assert/strict";

import {
  buildStagingEnvironmentInventory,
  STAGING_ENVIRONMENT_PHASES,
} from "../scripts/staging-environment-inventory";

const basePostboxEnv = {
  IB_RUNTIME_TARGET: "staging",
  IB_EMAIL_TARGET: "staging",
  YANDEX_POSTBOX_FROM_EMAIL: "stage@iburo.test",
  YANDEX_POSTBOX_ACCESS_KEY_ID: "stage-postbox-access-key",
  YANDEX_POSTBOX_SECRET_ACCESS_KEY: "postbox-secret-that-must-never-print",
  IB_STAGING_POSTBOX_FROM_EMAIL: "stage@iburo.test",
  IB_STAGING_POSTBOX_ACCESS_KEY_ID: "stage-postbox-access-key",
  IB_STAGING_POSTBOX_CONFIRM: "SIMULATOR:stage@iburo.test",
} as const;

function postbox(overrides: Record<string, string | undefined> = {}) {
  return buildStagingEnvironmentInventory({
    ...basePostboxEnv,
    ...overrides,
  }).phases.postbox;
}

assert.equal(
  (STAGING_ENVIRONMENT_PHASES.postbox as readonly string[]).includes(
    "YANDEX_POSTBOX_REQUEST_TIMEOUT_MS",
  ),
  false,
  "Postbox request timeout must remain optional because verifier has a default",
);
assert.equal(postbox().ready, true, "absent Postbox timeout must preserve verifier default readiness");

for (const value of ["1000", "30000"]) {
  const phase = postbox({ YANDEX_POSTBOX_REQUEST_TIMEOUT_MS: value });
  assert.equal(phase.ready, true, `verifier-supported Postbox timeout ${value} must be ready`);
  assert.deepEqual(phase.invalidOrInconsistent, []);
}

for (const value of ["999", "30001", "1.5", "abc"]) {
  const phase = postbox({ YANDEX_POSTBOX_REQUEST_TIMEOUT_MS: value });
  assert.equal(phase.ready, false, `verifier-rejected Postbox timeout ${value} must fail inventory`);
  assert.deepEqual(phase.invalidOrInconsistent, ["YANDEX_POSTBOX_REQUEST_TIMEOUT_MS"]);
  assert.equal(
    JSON.stringify(phase).includes(value),
    false,
    "inventory must report only the variable name and never the configured timeout value",
  );
}

console.log("STAGING_ENVIRONMENT_POSTBOX_TIMEOUT_TEST_PASS");
