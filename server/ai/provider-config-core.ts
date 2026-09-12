export const AI_PROVIDER_CONFIG_ERROR = "AI_PROVIDER_CONFIG_ERROR";

export type AiProviderName = "openai" | "yandex";

export type YandexGptRuntimeConfig = {
  apiKey: string;
  folderId: string;
  model: string;
  endpoint: "https://ai.api.cloud.yandex.net/foundationModels/v1/completion";
  requestTimeoutMs: number;
  maxOutputTokens: number;
  temperature: number;
};

function fail(name: string): never {
  throw new Error(`${AI_PROVIDER_CONFIG_ERROR}:${name}`);
}

function requireEnv(env: NodeJS.ProcessEnv, name: string) {
  const value = env[name]?.trim();
  if (!value) fail(name);
  if (/[\r\n\0]/.test(value)) fail(name);
  return value;
}

function readBoundedInteger(
  env: NodeJS.ProcessEnv,
  name: string,
  fallback: number,
  min: number,
  max: number,
) {
  const raw = env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) fail(name);
  return value;
}

export function readAiProviderName(env: NodeJS.ProcessEnv = process.env): AiProviderName {
  const raw = env.IB_AI_PROVIDER?.trim().toLowerCase();
  if (!raw) return "openai";
  if (raw === "openai" || raw === "yandex") return raw;
  return fail("IB_AI_PROVIDER");
}

export function readYandexGptRuntimeConfig(
  env: NodeJS.ProcessEnv = process.env,
): YandexGptRuntimeConfig {
  const apiKey = requireEnv(env, "YANDEX_AI_API_KEY");
  if (apiKey.length < 20) fail("YANDEX_AI_API_KEY");

  const folderId = requireEnv(env, "YANDEX_AI_FOLDER_ID");
  if (!/^[a-z0-9]{10,64}$/.test(folderId)) fail("YANDEX_AI_FOLDER_ID");

  const model = requireEnv(env, "IB_AI_YANDEX_MODEL");
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*(?:\/[A-Za-z0-9][A-Za-z0-9._-]*)?$/.test(model)) {
    fail("IB_AI_YANDEX_MODEL");
  }

  return {
    apiKey,
    folderId,
    model,
    endpoint: "https://ai.api.cloud.yandex.net/foundationModels/v1/completion",
    requestTimeoutMs: readBoundedInteger(
      env,
      "IB_AI_YANDEX_REQUEST_TIMEOUT_MS",
      20_000,
      1_000,
      60_000,
    ),
    maxOutputTokens: readBoundedInteger(
      env,
      "IB_AI_YANDEX_MAX_OUTPUT_TOKENS",
      1_200,
      128,
      4_000,
    ),
    temperature: 0.2,
  };
}
