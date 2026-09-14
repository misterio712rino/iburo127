import { randomUUID } from "node:crypto";
import type { AiModelGateway, AiModelInput } from "@/server/domain/ai/contracts";

export const AI_PROVIDER_ERROR = "AI_PROVIDER_ERROR";

export type OpenAiResponsesConfig = {
  apiKey: string;
  model: string;
  endpoint: "https://api.openai.com/v1/responses";
  requestTimeoutMs: number;
  maxOutputTokens: number;
};

export type OpenAiFetch = (
  input: string | URL,
  init?: RequestInit,
) => Promise<Response>;

function assertConfig(config: OpenAiResponsesConfig) {
  const validApiKey = config.apiKey.trim().length >= 20 && !/[\r\n\0]/.test(config.apiKey);
  const validModel = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(config.model);
  const validTimeout =
    Number.isInteger(config.requestTimeoutMs) &&
    config.requestTimeoutMs >= 1_000 &&
    config.requestTimeoutMs <= 60_000;
  const validOutputLimit =
    Number.isInteger(config.maxOutputTokens) &&
    config.maxOutputTokens >= 128 &&
    config.maxOutputTokens <= 4_000;

  if (
    !validApiKey ||
    !validModel ||
    config.endpoint !== "https://api.openai.com/v1/responses" ||
    !validTimeout ||
    !validOutputLimit
  ) {
    throw new Error(`${AI_PROVIDER_ERROR}:INVALID_CONFIG`);
  }
  return { ...config, apiKey: config.apiKey.trim(), model: config.model.trim() };
}

function assertSafetyIdentifier(value: string): string {
  const normalized = value.trim();
  if (!/^[a-f0-9]{64}$/.test(normalized)) {
    throw new Error(`${AI_PROVIDER_ERROR}:INVALID_SAFETY_IDENTIFIER`);
  }
  return normalized;
}

function extractOutputText(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${AI_PROVIDER_ERROR}:INVALID_RESPONSE`);
  }

  const response = value as { status?: unknown; output?: unknown };
  if (response.status !== "completed") {
    if (
      response.status === "incomplete" ||
      response.status === "failed" ||
      response.status === "cancelled" ||
      response.status === "queued" ||
      response.status === "in_progress"
    ) {
      throw new Error(`${AI_PROVIDER_ERROR}:RESPONSE_${response.status.toUpperCase()}`);
    }
    throw new Error(`${AI_PROVIDER_ERROR}:INVALID_RESPONSE`);
  }

  if (!Array.isArray(response.output)) {
    throw new Error(`${AI_PROVIDER_ERROR}:INVALID_RESPONSE`);
  }

  const parts: string[] = [];
  for (const item of response.output) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const entry of content) {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
      const typed = entry as { type?: unknown; text?: unknown };
      if (typed.type === "output_text" && typeof typed.text === "string") {
        parts.push(typed.text);
      }
    }
  }

  const text = parts.join("\n").trim();
  if (!text) throw new Error(`${AI_PROVIDER_ERROR}:EMPTY_RESPONSE`);
  return text;
}

export class OpenAiResponsesGateway implements AiModelGateway {
  private readonly config: OpenAiResponsesConfig;

  constructor(
    config: OpenAiResponsesConfig,
    private readonly fetchImpl: OpenAiFetch = fetch,
  ) {
    this.config = assertConfig(config);
  }

  async reply(input: AiModelInput): Promise<string> {
    const payload = JSON.stringify({
      model: this.config.model,
      store: false,
      tools: [],
      max_output_tokens: this.config.maxOutputTokens,
      safety_identifier: assertSafetyIdentifier(input.safetyIdentifier),
      instructions: input.instructions,
      input: input.messages.map((message) => ({
        role: message.role,
        content: [{ type: "input_text", text: message.content }],
      })),
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.requestTimeoutMs);
    let response: Response;

    try {
      response = await this.fetchImpl(this.config.endpoint, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.config.apiKey}`,
          "content-type": "application/json",
          "x-client-request-id": randomUUID(),
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
