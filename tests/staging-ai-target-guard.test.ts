import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  assertStagingAiTarget,
  STAGING_AI_TARGET_GUARD,
} from "@/scripts/staging-ai-target-guard";

const apiKey = "fixture-openai-key-material-that-is-long-enough";
const model = "gpt-5.6-terra";
const fingerprint = createHash("sha256").update(apiKey, "utf8").digest("hex");

function env(overrides: Record<string, string | undefined> = {}) {
  return {
    IB_RUNTIME_TARGET: "staging",
    IB_AI_TARGET: "staging",
    OPENAI_API_KEY: apiKey,
    IB_AI_OPENAI_MODEL: model,
    IB_STAGING_OPENAI_MODEL: model,
    IB_STAGING_OPENAI_KEY_SHA256: fingerprint,
    IB_STAGING_AI_CONFIRM: `AI-SMOKE:${model}:${fingerprint}`,
    ...overrides,
  };
}

assert.deepEqual(assertStagingAiTarget(env()), { apiKey, model });

for (const [name, overrides, code] of [
  ["runtime-missing", { IB_RUNTIME_TARGET: undefined }, "RUNTIME_TARGET_NOT_STAGING"],
  ["runtime-production", { IB_RUNTIME_TARGET: "production" }, "RUNTIME_TARGET_NOT_STAGING"],
  ["target", { IB_AI_TARGET: "production" }, "TARGET_NOT_STAGING"],
  ["model", { IB_STAGING_OPENAI_MODEL: "other-model" }, "MODEL_MISMATCH"],
  ["fingerprint-format", { IB_STAGING_OPENAI_KEY_SHA256: "bad" }, "INVALID_KEY_FINGERPRINT"],
  [
    "key",
    { OPENAI_API_KEY: "different-fixture-key-material-that-is-long-enough" },
    "KEY_MISMATCH",
  ],
  ["confirmation", { IB_STAGING_AI_CONFIRM: "" }, "CONFIRMATION_MISMATCH"],
] as const) {
  assert.throws(
    () => assertStagingAiTarget(env(overrides)),
    new RegExp(`${STAGING_AI_TARGET_GUARD}:${code}`),
    name,
  );
}

console.log("STAGING_AI_TARGET_GUARD_TEST_PASS");
