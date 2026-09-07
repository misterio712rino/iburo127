import "./ai-plan-entitlement-contract.test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildProviderAwareStagingAiReadiness } from "@/scripts/staging-ai-readiness";
import {
  assertStagingAiTarget,
  STAGING_AI_TARGET_GUARD,
} from "@/scripts/staging-ai-target-guard";
import {
  assertStagingYandexAiTarget,
  STAGING_YANDEX_AI_TARGET_GUARD,
} from "@/scripts/staging-yandex-ai-target-guard";

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

const yandexBaseEnv = {
  IB_RUNTIME_TARGET: "staging",
  IB_AI_TARGET: "staging",
  IB_AI_PROVIDER: "yandex",
  YANDEX_AI_FOLDER_ID: "b1ggvchbjvrt2b5rju0g",
  IB_AI_YANDEX_MODEL: "yandexgpt/latest",
  IB_STAGING_YANDEX_AI_FOLDER_ID: "b1ggvchbjvrt2b5rju0g",
  IB_STAGING_YANDEX_AI_MODEL: "yandexgpt/latest",
  IB_STAGING_YANDEX_AI_CONFIRM:
    "YANDEX-AI-SMOKE:b1ggvchbjvrt2b5rju0g:yandexgpt/latest",
} as const;

for (const wrongCredential of [
  `aje${"a".repeat(17)}`,
  `YC${"A".repeat(38)}`,
  "PLEASE DO NOT REMOVE THIS LINE! Yandex.Cloud SA Key ID fixture",
  `t1.${"a".repeat(20)}.${"b".repeat(86)}`,
]) {
  const wrongEnv = { ...yandexBaseEnv, YANDEX_AI_API_KEY: wrongCredential };
  assert.throws(
    () => assertStagingYandexAiTarget(wrongEnv),
    new RegExp(`${STAGING_YANDEX_AI_TARGET_GUARD}:INVALID_API_KEY_TYPE`),
  );
  const readiness = buildProviderAwareStagingAiReadiness(wrongEnv);
  assert.equal(readiness.ready, false);
  assert.deepEqual(readiness.missingOrPlaceholder, []);
  assert.deepEqual(readiness.invalidOrInconsistent, ["YANDEX_AI_API_KEY"]);
}

const stagingAiVerifyRoute = await readFile(
  resolve("app/%5Fiburo/staging-ai-verify/route.ts"),
  "utf8",
);
assert.match(stagingAiVerifyRoute, /x-iburo-staging-ai-confirm/);
assert.match(stagingAiVerifyRoute, /RUN_STAGING_AI_VERIFY/);
assert.match(stagingAiVerifyRoute, /isExactStagingPreview/);
assert.match(stagingAiVerifyRoute, /assertStagingYandexAiTarget/);
assert.match(stagingAiVerifyRoute, /new YandexGptGateway/);
assert.match(stagingAiVerifyRoute, /IB_AI_STAGING_OK/);
assert.match(stagingAiVerifyRoute, /clientCaseDataIncluded: false/);
assert.match(stagingAiVerifyRoute, /providerResponseLogged: false/);
assert.match(stagingAiVerifyRoute, /providerRequestDataLogging: "disabled"/);
assert.doesNotMatch(stagingAiVerifyRoute, /console\.(?:log|error)\(/);

const yandexSmokeWorkflow = await readFile(
  resolve(".github/workflows/staging-yandex-ai-smoke.yml"),
  "utf8",
);
assert.match(yandexSmokeWorkflow, /x-iburo-staging-ai-confirm: RUN_STAGING_AI_VERIFY/);
assert.match(yandexSmokeWorkflow, /\/_iburo\/staging-ai-verify/);
assert.match(yandexSmokeWorkflow, /body\.provider !== "yandex"/);
assert.match(yandexSmokeWorkflow, /body\.markerMatched !== true/);
assert.match(yandexSmokeWorkflow, /STAGING_YANDEX_AI_VERIFY_PASS/);

console.log("STAGING_AI_TARGET_GUARD_TEST_PASS");
