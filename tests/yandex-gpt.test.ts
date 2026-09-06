import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  AI_PROVIDER_CONFIG_ERROR,
  readAiProviderName,
  readYandexGptRuntimeConfig,
} from "@/server/ai/provider-config-core";
import { YandexGptGateway } from "@/server/ai/yandex-gpt-core";
import { buildProviderAwareStagingAiReadiness } from "@/scripts/staging-ai-readiness";
import {
  assertStagingYandexAiTarget,
  STAGING_YANDEX_AI_TARGET_GUARD,
} from "@/scripts/staging-yandex-ai-target-guard";

assert.equal(readAiProviderName({} as NodeJS.ProcessEnv), "openai");
assert.equal(
  readAiProviderName({ IB_AI_PROVIDER: " YANDEX " } as unknown as NodeJS.ProcessEnv),
  "yandex",
);
assert.throws(
  () =>
    readAiProviderName({ IB_AI_PROVIDER: "unknown" } as unknown as NodeJS.ProcessEnv),
  new RegExp(`${AI_PROVIDER_CONFIG_ERROR}:IB_AI_PROVIDER`),
);

const apiKey = "y".repeat(40);
const env = {
  YANDEX_AI_API_KEY: apiKey,
  YANDEX_AI_FOLDER_ID: "b1ggvchbjvrt2b5rju0g",
  IB_AI_YANDEX_MODEL: "yandexgpt/latest",
  IB_AI_YANDEX_REQUEST_TIMEOUT_MS: "2500",
  IB_AI_YANDEX_MAX_OUTPUT_TOKENS: "900",
} as unknown as NodeJS.ProcessEnv;
const config = readYandexGptRuntimeConfig(env);
assert.deepEqual(config, {
  apiKey,
  folderId: env.YANDEX_AI_FOLDER_ID,
  model: "yandexgpt/latest",
  endpoint: "https://ai.api.cloud.yandex.net/foundationModels/v1/completion",
  requestTimeoutMs: 2_500,
  maxOutputTokens: 900,
  temperature: 0.2,
});
assert.throws(
  () => readYandexGptRuntimeConfig({ ...env, YANDEX_AI_FOLDER_ID: "../foreign" }),
  new RegExp(`${AI_PROVIDER_CONFIG_ERROR}:YANDEX_AI_FOLDER_ID`),
);
assert.throws(
  () => readYandexGptRuntimeConfig({ ...env, IB_AI_YANDEX_MODEL: "../foreign/latest" }),
  new RegExp(`${AI_PROVIDER_CONFIG_ERROR}:IB_AI_YANDEX_MODEL`),
);

const safetyIdentifier = "b".repeat(64);
const modelInput = {
  instructions: "System legal-safety rules",
  messages: [
    { role: "user" as const, content: "Первый вопрос" },
    { role: "assistant" as const, content: "Первый ответ" },
    { role: "user" as const, content: "Уточнение" },
  ],
  safetyIdentifier,
};

let capturedUrl = "";
let capturedInit: RequestInit | undefined;
const gateway = new YandexGptGateway(config, async (input, init) => {
  capturedUrl = String(input);
  capturedInit = init;
  return Response.json({
    result: {
      alternatives: [
        {
          message: { role: "assistant", text: "Предварительный ответ." },
          status: "ALTERNATIVE_STATUS_FINAL",
        },
      ],
      usage: {
        inputTextTokens: "10",
        completionTokens: "3",
        totalTokens: "13",
      },
      modelVersion: "test",
    },
  });
});

const output = await gateway.reply(modelInput);
assert.equal(output, "Предварительный ответ.");
assert.equal(
  capturedUrl,
  "https://ai.api.cloud.yandex.net/foundationModels/v1/completion",
);
assert.equal(capturedInit?.method, "POST");
const headers = new Headers(capturedInit?.headers);
assert.equal(headers.get("authorization"), `Api-Key ${apiKey}`);
assert.equal(headers.get("content-type"), "application/json");
assert.equal(
  headers.get("x-data-logging-enabled"),
  "false",
  "legal-client prompts must opt out of Yandex AI request data logging",
);

const payloadText = String(capturedInit?.body);
const payload = JSON.parse(payloadText) as {
  modelUri: string;
  completionOptions: {
    stream: boolean;
    temperature: number;
    maxTokens: string;
  };
  messages: Array<{ role: string; text: string }>;
};
assert.equal(
  payload.modelUri,
  "gpt://b1ggvchbjvrt2b5rju0g/yandexgpt/latest",
);
assert.deepEqual(payload.completionOptions, {
  stream: false,
  temperature: 0.2,
  maxTokens: "900",
});
assert.deepEqual(payload.messages, [
  { role: "system", text: "System legal-safety rules" },
  { role: "user", text: "Первый вопрос" },
  { role: "assistant", text: "Первый ответ" },
  { role: "user", text: "Уточнение" },
]);
assert.doesNotMatch(
  payloadText,
  new RegExp(safetyIdentifier),
  "pseudonymous safety identifier must remain inside iBuro and must not be sent to Yandex",
);

const httpFailure = new YandexGptGateway(config, async () =>
  new Response("provider detail must not escape", { status: 429 }),
);
await assert.rejects(() => httpFailure.reply(modelInput), /AI_PROVIDER_ERROR:HTTP_429/);

const filteredResponse = new YandexGptGateway(config, async () =>
  Response.json({
    result: {
      alternatives: [
        {
          message: { role: "assistant", text: "" },
          status: "ALTERNATIVE_STATUS_CONTENT_FILTER",
        },
      ],
    },
  }),
);
await assert.rejects(
  () => filteredResponse.reply(modelInput),
  /AI_PROVIDER_ERROR:CONTENT_FILTERED/,
);

const truncatedResponse = new YandexGptGateway(config, async () =>
  Response.json({
    result: {
      alternatives: [
        {
          message: { role: "assistant", text: "Do not accept partial output" },
          status: "ALTERNATIVE_STATUS_TRUNCATED_FINAL",
        },
      ],
    },
  }),
);
await assert.rejects(
  () => truncatedResponse.reply(modelInput),
  /AI_PROVIDER_ERROR:RESPONSE_INCOMPLETE/,
);

const invalidResponse = new YandexGptGateway(config, async () =>
  Response.json({ result: { alternatives: [] } }),
);
await assert.rejects(() => invalidResponse.reply(modelInput), /AI_PROVIDER_ERROR:INVALID_RESPONSE/);

const networkFailure = new YandexGptGateway(config, async () => {
  throw new Error("raw network error with provider details");
});
await assert.rejects(() => networkFailure.reply(modelInput), /AI_PROVIDER_ERROR:NETWORK/);

let invalidIdentifierFetchCalls = 0;
const invalidIdentifierGateway = new YandexGptGateway(config, async () => {
  invalidIdentifierFetchCalls += 1;
  throw new Error("fetch must not run");
});
await assert.rejects(
  () =>
    invalidIdentifierGateway.reply({
      ...modelInput,
      safetyIdentifier: "raw-user@example.test",
    }),
  /AI_PROVIDER_ERROR:INVALID_SAFETY_IDENTIFIER/,
);
assert.equal(invalidIdentifierFetchCalls, 0);

assert.throws(
  () =>
    new YandexGptGateway({
      ...config,
      endpoint:
        "https://evil.example/foundationModels/v1/completion" as typeof config.endpoint,
    }),
  /AI_PROVIDER_ERROR:INVALID_CONFIG/,
);

const stagingTargetEnv = {
  IB_RUNTIME_TARGET: "staging",
  IB_AI_TARGET: "staging",
  IB_AI_PROVIDER: "yandex",
  YANDEX_AI_API_KEY: apiKey,
  YANDEX_AI_FOLDER_ID: "b1ggvchbjvrt2b5rju0g",
  IB_AI_YANDEX_MODEL: "yandexgpt/latest",
  IB_STAGING_YANDEX_AI_FOLDER_ID: "b1ggvchbjvrt2b5rju0g",
  IB_STAGING_YANDEX_AI_MODEL: "yandexgpt/latest",
  IB_STAGING_YANDEX_AI_CONFIRM:
    "YANDEX-AI-SMOKE:b1ggvchbjvrt2b5rju0g:yandexgpt/latest",
} as const;
const expectedStagingTarget = {
  apiKey,
  folderId: "b1ggvchbjvrt2b5rju0g",
  model: "yandexgpt/latest",
};
assert.deepEqual(assertStagingYandexAiTarget(stagingTargetEnv), expectedStagingTarget);
assert.deepEqual(
  assertStagingYandexAiTarget({
    ...stagingTargetEnv,
    IB_STAGING_YANDEX_AI_KEY_SHA256: "0".repeat(64),
  }),
  expectedStagingTarget,
  "legacy key fingerprint env must not affect Yandex staging target authorization",
);

const yandexReadiness = buildProviderAwareStagingAiReadiness({
  ...stagingTargetEnv,
  IB_STAGING_YANDEX_AI_KEY_SHA256: "stale-or-mismatched-legacy-value",
});
assert.equal(yandexReadiness.provider, "yandex");
assert.equal(yandexReadiness.ready, true);
assert.equal(yandexReadiness.requiredCount, 9);
assert.deepEqual(yandexReadiness.missingOrPlaceholder, []);
assert.deepEqual(yandexReadiness.invalidOrInconsistent, []);

for (const badEnv of [
  { ...stagingTargetEnv, IB_RUNTIME_TARGET: "production" },
  { ...stagingTargetEnv, IB_AI_TARGET: "production" },
  { ...stagingTargetEnv, IB_AI_PROVIDER: "openai" },
  { ...stagingTargetEnv, YANDEX_AI_API_KEY: "too-short" },
  { ...stagingTargetEnv, IB_STAGING_YANDEX_AI_FOLDER_ID: "b1gotherfolder0000000" },
  { ...stagingTargetEnv, IB_STAGING_YANDEX_AI_MODEL: "other/latest" },
  { ...stagingTargetEnv, IB_STAGING_YANDEX_AI_CONFIRM: "wrong" },
  {
    ...stagingTargetEnv,
    IB_STAGING_YANDEX_AI_CONFIRM:
      `YANDEX-AI-SMOKE:b1ggvchbjvrt2b5rju0g:yandexgpt/latest:${"0".repeat(64)}`,
  },
]) {
  assert.throws(
    () => assertStagingYandexAiTarget(badEnv),
    new RegExp(`${STAGING_YANDEX_AI_TARGET_GUARD}:`),
  );
}

const [runtimeSource, verifierDispatcherSource, yandexVerifierSource, yandexSmokeWorkflow] =
  await Promise.all([
    readFile(resolve("server/ai/runtime.ts"), "utf8"),
    readFile(resolve("scripts/verify-staging-openai.ts"), "utf8"),
    readFile(resolve("scripts/verify-staging-yandex-ai.ts"), "utf8"),
    readFile(resolve(".github/workflows/staging-yandex-ai-smoke.yml"), "utf8"),
  ]);
assert.match(runtimeSource, /readAiProviderName/);
assert.match(runtimeSource, /provider === "yandex"/);
assert.match(runtimeSource, /new YandexGptGateway\(readYandexGptRuntimeConfig\(\)\)/);
assert.match(runtimeSource, /new OpenAiResponsesGateway\(readOpenAiRuntimeConfig\(\)\)/);
assert.match(verifierDispatcherSource, /readAiProviderName\(process\.env\)/);
assert.match(verifierDispatcherSource, /provider === "yandex"/);
assert.match(verifierDispatcherSource, /verify-staging-yandex-ai/);
assert.match(verifierDispatcherSource, /verify-staging-openai-provider/);
assert.match(yandexVerifierSource, /IB_AI_STAGING_OK/);
assert.match(yandexVerifierSource, /temperature: 0/);
assert.match(yandexVerifierSource, /Client\/case data included: 0/);
assert.match(yandexVerifierSource, /Provider response content logged: 0/);
assert.match(yandexSmokeWorkflow, /scripts\/staging-yandex-ai-target-guard\.ts/);
assert.match(yandexSmokeWorkflow, /server\/ai\/yandex-gpt-core\.ts/);
assert.doesNotMatch(yandexSmokeWorkflow, /credential fingerprint rotation/);

console.log("YANDEX_GPT_TRANSPORT_TEST_PASS");
