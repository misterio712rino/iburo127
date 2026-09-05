import type { AiModelGateway, AiModelInput } from "@/server/domain/ai/contracts";

export const AI_PROVIDER_ERROR = "AI_PROVIDER_ERROR";

export type YandexGptConfig = {
  apiKey: string;
  folderId: string;
  model: string;
  endpoint: "https://ai.api.cloud.yandex.net/foundationModels/v1/completion";
  requestTimeoutMs: number;
  maxOutputTokens: number;
  temperature: number;
};

export type YandexGptFetch = (
  input: string | URL,
  init?: RequestInit,
) => Promise<Response>;

function assertConfig(config: YandexGptConfig): YandexGptConfig {
  const validApiKey = config.apiKey.trim().length >= 20 && !/[\r\n\0]/.test(config.apiKey);
  const validFolderId = /^[a-z0-9]{10,64}$/.test(config.folderId);
  const validModel =
    /^[A-Za-z0-9][A-Za-z0-9._-]*(?:\/[A-Za-z0-9][A-Za-z0-9._-]*)?$/.test(config.model);
  const validTimeout =
    Number.isInteger(config.requestTimeoutMs) &&
    config.requestTimeoutMs >= 1_000 &&
    config.requestTimeoutMs <= 60_000;
  const validOutputLimit =
    Number.isInteger(config.maxOutputTokens) &&
    config.maxOutputTokens >= 128 &&
    config.maxOutputTokens <= 4_000;
  const validTemperature =
    Number.isFinite(config.temperature) && config.temperature >= 0 && config.temperature <= 1;

  if (
    !validApiKey ||
    !validFolderId ||
    !validModel ||
    config.endpoint !== "https://ai.api.cloud.yandex.net/foundationModels/v1/completion" ||
    !validTimeout ||
    !validOutputLimit ||
    !validTemperature
  ) {
    throw new Error(`${AI_PROVIDER_ERROR}:INVALID_CONFIG`);
  }

  return {
    ...config,
    apiKey: config.apiKey.trim(),
    folderId: config.folderId.trim(),
    model: config.model.trim(),
  };
}

function assertSafetyIdentifier(value: string): void {
  if (!/^[a-f0-9]{64}$/.test(value.trim())) {
    throw new Error(`${AI_PROVIDER_ERROR}:INVALID_SAFETY_IDENTIFIER`);
  }
}

function extractOutputText(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${AI_PROVIDER_ERROR}:INVALID_RESPONSE`);
  }

  const result = (value as { result?: unknown }).result;
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    throw new Error(`${AI_PROVIDER_ERROR}:INVALID_RESPONSE`);
  }

  const alternatives = (result as { alternatives?: unknown }).alternatives;
  if (!Array.isArray(alternatives) || alternatives.length === 0) {
    throw new Error(`${AI_PROVIDER_ERROR}:INVALID_RESPONSE`);
  }

  for (const alternative of alternatives) {
    if (!alternative || typeof alternative !== "object" || Array.isArray(alternative)) continue;
    const typed = alternative as { status?: unknown; message?: unknown };
    if (typed.status !== "ALTERNATIVE_STATUS_FINAL") continue;
    if (!typed.message || typeof typed.message !== "object" || Array.isArray(typed.message)) continue;

    const text = (typed.message as { text?: unknown }).text;
    if (typeof text === "string" && text.trim()) return text.trim();
  }

  const statuses = alternatives
    .map((alternative) =>
      alternative && typeof alternative === "object" && !Array.isArray(alternative)
        ? (alternative as { status?: unknown }).status
        : undefined,
    )
    .filter((status): status is string => typeof status === "string");

  if (statuses.includes("ALTERNATIVE_STATUS_CONTENT_FILTER")) {
    throw new Error(`${AI_PROVIDER_ERROR}:CONTENT_FILTERED`);
  }
  if (
    statuses.includes("ALTERNATIVE_STATUS_PARTIAL") ||
    statuses.includes("ALTERNATIVE_STATUS_TRUNCATED_FINAL") ||
    statuses.includes("ALTERNATIVE_STATUS_TOOL_CALLS")
  ) {
    throw new Error(`${AI_PROVIDER_ERROR}:RESPONSE_INCOMPLETE`);
  }

  throw new Error(`${AI_PROVIDER_ERROR}:EMPTY_RESPONSE`);
}

export class YandexGptGateway implements AiModelGateway {
  private readonly config: YandexGptConfig;

  constructor(
    config: YandexGptConfig,
    private readonly fetchImpl: YandexGptFetch = fetch,
  ) {
    this.config = assertConfig(config);
  }

  async reply(input: AiModelInput): Promise<string> {
    // Preserve the same pseudonymous identifier validation used by other
    // providers, but do not transmit it: Yandex Text Generation has no
    // equivalent field and the provider does not need this identifier.
    assertSafetyIdentifier(input.safetyIdentifier);

    const payload = JSON.stringify({
      modelUri: `gpt://${this.config.folderId}/${this.config.model}`,
      completionOptions: {
        stream: false,
        temperature: this.config.temperature,
        maxTokens: String(this.config.maxOutputTokens),
      },
      messages: [
        { role: "system", text: input.instructions },
        ...input.messages.map((message) => ({
          role: message.role,
          text: message.content,
        })),
      ],
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.requestTimeoutMs);
    let response: Response;

    try {
      response = await this.fetchImpl(this.config.endpoint, {
        method: "POST",
        headers: {
          authorization: `Api-Key ${this.config.apiKey}`,
          "content-type": "application/json",
        },
        body: payload,
        cache: "no-store",
        signal: controller.signal,
      });
    } catch {
      if (controller.signal.aborted) {
        throw new Error(`${AI_PROVIDER_ERROR}:TIMEOUT`);
      }
      throw new Error(`${AI_PROVIDER_ERROR}:NETWORK`);
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      throw new Error(`${AI_PROVIDER_ERROR}:HTTP_${response.status}`);
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new Error(`${AI_PROVIDER_ERROR}:INVALID_RESPONSE`);
    }

    return extractOutputText(body);
  }
}
