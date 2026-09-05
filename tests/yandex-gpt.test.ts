import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  AI_PROVIDER_CONFIG_ERROR,
  readAiProviderName,
  readYandexGptRuntimeConfig,
} from "@/server/ai/provider-config-core";
import { YandexGptGateway } from "@/server/ai/yandex-gpt-core";

assert.equal(readAiProviderName({} as NodeJS.ProcessEnv), "openai");
assert.equal(
  readAiProviderName({ IB_AI_PROVIDER: " YANDEX " } as NodeJS.ProcessEnv),
  "yandex",
);
assert.throws(
  () => readAiProviderName({ IB_AI_PROVIDER: "unknown" } as NodeJS.ProcessEnv),
  new RegExp(`${AI_PROVIDER_CONFIG_ERROR}:IB_AI_PROVIDER`),
);

const env = {
  YANDEX_AI_API_KEY: "AQVN-test-123456789012345678901234567890",
  YANDEX_AI_FOLDER_ID: "b1ggvchbjvrt2b5rju0g",
  IB_AI_YANDEX_MODEL: "yandexgpt/latest",
  IB_AI_YANDEX_REQUEST_TIMEOUT_MS: "2500",
  IB_AI_YANDEX_MAX_OUTPUT_TOKENS: "900",
} as NodeJS.ProcessEnv;
const config = readYandexGptRuntimeConfig(env);
assert.deepEqual(config, {
  apiKey: env.YANDEX_AI_API_KEY,
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
assert.equal(headers.get("authorization"), `Api-Key ${env.YANDEX_AI_API_KEY}`);
assert.equal(headers.get("content-type"), "application/json");

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

const runtimeSource = await readFile(resolve("server/ai/runtime.ts"), "utf8");
assert.match(runtimeSource, /readAiProviderName/);
assert.match(runtimeSource, /provider === "yandex"/);
assert.match(runtimeSource, /new YandexGptGateway\(readYandexGptRuntimeConfig\(\)\)/);
assert.match(runtimeSource, /new OpenAiResponsesGateway\(readOpenAiRuntimeConfig\(\)\)/);

console.log("YANDEX_GPT_TRANSPORT_TEST_PASS");
