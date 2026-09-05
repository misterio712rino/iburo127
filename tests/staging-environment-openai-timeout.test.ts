import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import { buildProviderAwareStagingAiReadiness } from "../scripts/staging-ai-readiness";
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

const providerAwareOpenAi = buildProviderAwareStagingAiReadiness(baseEnv);
assert.equal(providerAwareOpenAi.provider, "openai", "missing provider must preserve the runtime OpenAI default");
assert.equal(providerAwareOpenAi.ready, true);
assert.deepEqual(providerAwareOpenAi.missingOrPlaceholder, []);
assert.deepEqual(providerAwareOpenAi.invalidOrInconsistent, []);
assert.equal(providerAwareOpenAi.networkAccessed, false);
assert.equal(providerAwareOpenAi.valuesPrinted, false);
assert.equal(JSON.stringify(providerAwareOpenAi).includes(apiKey), false);

for (const timeout of ["999", "60001", "1.5", "abc"] as const) {
  const readiness = buildProviderAwareStagingAiReadiness({
    ...baseEnv,
    IB_AI_OPENAI_REQUEST_TIMEOUT_MS: timeout,
  });
  assert.equal(readiness.ready, false);
  assert.ok(readiness.invalidOrInconsistent.includes("IB_AI_OPENAI_REQUEST_TIMEOUT_MS"));
  assert.equal(JSON.stringify(readiness).includes(timeout), false);
}

const yandexApiKey = "yandex-staging-key-that-must-never-print";
const yandexFingerprint = createHash("sha256").update(yandexApiKey, "utf8").digest("hex");
const yandexEnv = {
  IB_RUNTIME_TARGET: "staging",
  IB_AI_TARGET: "staging",
  IB_AI_PROVIDER: "yandex",
  YANDEX_AI_API_KEY: yandexApiKey,
  YANDEX_AI_FOLDER_ID: "b1ggvchbjvrt2b5rju0g",
  IB_AI_YANDEX_MODEL: "yandexgpt/latest",
  IB_STAGING_YANDEX_AI_FOLDER_ID: "b1ggvchbjvrt2b5rju0g",
  IB_STAGING_YANDEX_AI_MODEL: "yandexgpt/latest",
  IB_STAGING_YANDEX_AI_KEY_SHA256: yandexFingerprint,
  IB_STAGING_YANDEX_AI_CONFIRM:
    `YANDEX-AI-SMOKE:b1ggvchbjvrt2b5rju0g:yandexgpt/latest:${yandexFingerprint}`,
} as const;

const providerAwareYandex = buildProviderAwareStagingAiReadiness(yandexEnv);
const yandexMissingRequirements: readonly string[] = providerAwareYandex.missingOrPlaceholder;
assert.equal(
  yandexMissingRequirements.some((name) => name.startsWith("OPENAI_")),
  false,
  "Yandex readiness must not require OpenAI credentials",
);
assert.equal(providerAwareYandex.provider, "yandex");
assert.equal(providerAwareYandex.ready, true);
assert.deepEqual(providerAwareYandex.missingOrPlaceholder, []);
assert.deepEqual(providerAwareYandex.invalidOrInconsistent, []);
assert.equal(providerAwareYandex.networkAccessed, false);
assert.equal(providerAwareYandex.valuesPrinted, false);
const yandexSerialized = JSON.stringify(providerAwareYandex);
assert.equal(yandexSerialized.includes(yandexApiKey), false, "readiness must never expose the Yandex API key");
assert.equal(yandexSerialized.includes(yandexFingerprint), false, "readiness must never expose the Yandex key fingerprint");

const mismatchedYandexFolder = buildProviderAwareStagingAiReadiness({
  ...yandexEnv,
  IB_STAGING_YANDEX_AI_FOLDER_ID: "b1gotherfolder0000000",
});
assert.equal(mismatchedYandexFolder.ready, false);
assert.ok(mismatchedYandexFolder.invalidOrInconsistent.includes("YANDEX_AI_FOLDER_ID"));
assert.ok(mismatchedYandexFolder.invalidOrInconsistent.includes("IB_STAGING_YANDEX_AI_FOLDER_ID"));

for (const timeout of ["999", "60001", "1.5", "abc"] as const) {
  const readiness = buildProviderAwareStagingAiReadiness({
    ...yandexEnv,
    IB_AI_YANDEX_REQUEST_TIMEOUT_MS: timeout,
  });
  assert.equal(readiness.ready, false);
  assert.ok(readiness.invalidOrInconsistent.includes("IB_AI_YANDEX_REQUEST_TIMEOUT_MS"));
  assert.equal(JSON.stringify(readiness).includes(timeout), false);
}

for (const maxTokens of ["127", "4001", "1.5", "abc"] as const) {
  const readiness = buildProviderAwareStagingAiReadiness({
    ...yandexEnv,
    IB_AI_YANDEX_MAX_OUTPUT_TOKENS: maxTokens,
  });
  assert.equal(readiness.ready, false);
  assert.ok(readiness.invalidOrInconsistent.includes("IB_AI_YANDEX_MAX_OUTPUT_TOKENS"));
  assert.equal(JSON.stringify(readiness).includes(maxTokens), false);
}

const invalidProvider = buildProviderAwareStagingAiReadiness({
  ...baseEnv,
  IB_AI_PROVIDER: "unknown",
});
assert.equal(invalidProvider.provider, null);
assert.equal(invalidProvider.ready, false);
assert.deepEqual(invalidProvider.invalidOrInconsistent, ["IB_AI_PROVIDER"]);

console.log("STAGING_ENVIRONMENT_OPENAI_TIMEOUT_TEST_PASS");
