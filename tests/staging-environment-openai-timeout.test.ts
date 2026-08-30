import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import { buildStagingEnvironmentInventory } from "../scripts/staging-environment-inventory";

const apiKey = "openai-staging-timeout-regression-key";
const fingerprint = createHash("sha256").update(apiKey, "utf8").digest("hex");

const baseEnv = {
  IB_RUNTIME_TARGET: "staging",
  IB_AI_TARGET: "staging",
  OPENAI_API_KEY: apiKey,
  IB_AI_OPENAI_MODEL: "gpt-stage-model",
  IB_STAGING_OPENAI_MODEL: "gpt-stage-model",
  IB_STAGING_OPENAI_KEY_SHA256: fingerprint,
  IB_STAGING_AI_CONFIRM: `AI-SMOKE:gpt-stage-model:${fingerprint}`,
} as const;

for (const timeout of [undefined, "1000", "60000"] as const) {
  const inventory = buildStagingEnvironmentInventory({
    ...baseEnv,
    ...(timeout === undefined ? {} : { IB_AI_OPENAI_REQUEST_TIMEOUT_MS: timeout }),
  });
  assert.equal(inventory.phases.openai.ready, true, `timeout ${timeout ?? "absent"} must be accepted`);
  assert.deepEqual(inventory.phases.openai.invalidOrInconsistent, []);
}

for (const timeout of ["999", "60001", "1.5", "abc"] as const) {
  const inventory = buildStagingEnvironmentInventory({
    ...baseEnv,
    IB_AI_OPENAI_REQUEST_TIMEOUT_MS: timeout,
  });
  assert.equal(inventory.phases.openai.ready, false, `timeout ${timeout} must fail closed`);
  assert.ok(
    inventory.phases.openai.invalidOrInconsistent.includes("IB_AI_OPENAI_REQUEST_TIMEOUT_MS"),
    `timeout ${timeout} must be reported by variable name only`,
  );
  assert.equal(JSON.stringify(inventory).includes(timeout), false, "inventory must not expose timeout values");
}

const redactionSentinel = "54321";
const redactedInventory = buildStagingEnvironmentInventory({
  ...baseEnv,
  IB_AI_OPENAI_REQUEST_TIMEOUT_MS: redactionSentinel,
});
assert.equal(redactedInventory.phases.openai.ready, true);
assert.equal(JSON.stringify(redactedInventory).includes(redactionSentinel), false);

console.log("STAGING_ENVIRONMENT_OPENAI_TIMEOUT_TEST_PASS");
