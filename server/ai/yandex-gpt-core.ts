import type { AiModelGateway, AiModelInput } from "@/server/domain/ai/contracts";

export const AI_PROVIDER_ERROR = "AI_PROVIDER_ERROR";

type YandexBadRequestCategory =
  | "SCOPE"
  | "MODEL"
  | "FOLDER_NOT_FOUND"
  | "FOLDER_ACCESS"
  | "FOLDER_ID"
  | "FOLDER"
  | "MAX_TOKENS"
  | "TEMPERATURE"
  | "MESSAGES"
  | "OPTIONS"
  | "REQUEST"
  | "OTHER";

type YandexForbiddenCategory =
  | "BILLING_SUSPENDED"
  | "BILLING"
  | "SERVICE_ACCOUNT_SUSPENDED"
  | "ACCESS_POLICY"
  | "SCOPE"
  | "IAM"
  | "OTHER";

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

function classifyYandexBadRequestDiagnostic(raw: string): YandexBadRequestCategory {
  const diagnostic = raw.toLowerCase();

  if (/\bscope\b|scopes|foundationmodels\.execute|languagemodels\.execute/.test(diagnostic)) {
    return "SCOPE";
  }
  if (/modeluri|model_uri|model uri|model id|model name|unknown model|invalid model/.test(diagnostic)) {
    return "MODEL";
  }
  if (
    /folder[^\r\n]{0,120}(not found|does not exist|doesn't exist|unknown)|(?:not found|does not exist|doesn't exist|unknown)[^\r\n]{0,120}folder/.test(
      diagnostic,
    )
  ) {
    return "FOLDER_NOT_FOUND";
  }
  if (
    /folder[^\r\n]{0,120}(permission|access|authorized|authorised|allowed|forbidden)|(?:permission|access|authorized|authorised|allowed|forbidden)[^\r\n]{0,120}folder/.test(
      diagnostic,
    )
  ) {
    return "FOLDER_ACCESS";
  }
  if (/folderid|folder_id|folder id/.test(diagnostic)) {
    return "FOLDER_ID";
  }
  if (/\bfolder\b/.test(diagnostic)) {
    return "FOLDER";
  }
  if (/maxtokens|max_tokens|max tokens/.test(diagnostic)) {
    return "MAX_TOKENS";
  }
  if (/temperature/.test(diagnostic)) {
    return "TEMPERATURE";
  }
  if (/messages?|message\[|message\./.test(diagnostic)) {
    return "MESSAGES";
  }
  if (/completionoptions|completion_options|completion options|reasoningoptions|reasoning_options/.test(diagnostic)) {
    return "OPTIONS";
  }
  if (/request validation|request format|invalid argument|invalid_argument|bad request/.test(diagnostic)) {
    return "REQUEST";
  }
  return "OTHER";
}

function classifyYandexForbiddenDiagnostic(raw: string): YandexForbiddenCategory {
  const diagnostic = raw.toLowerCase();

  if (/\bscope\b|scopes|foundationmodels\.execute|languagemodels\.execute/.test(diagnostic)) {
    return "SCOPE";
  }
  if (
    /service account[^\r\n]{0,160}(suspend|disabled|blocked)|(?:suspend|disabled|blocked)[^\r\n]{0,160}service account/.test(
      diagnostic,
    )
  ) {
    return "SERVICE_ACCOUNT_SUSPENDED";
  }
  if (
    /(?:billing|payment|balance|arrears|debt)[^\r\n]{0,160}(?:suspend|blocked|disabled|overdue|payment required)|(?:suspend|blocked|disabled|overdue|payment required)[^\r\n]{0,160}(?:billing|payment|balance|arrears|debt)/.test(
      diagnostic,
    )
  ) {
    return "BILLING_SUSPENDED";
  }
  if (/billing account|\bbilling\b|payment required|insufficient funds|\bbalance\b|arrears|\bdebt\b/.test(diagnostic)) {
    return "BILLING";
  }
  if (
    /access polic|organization polic|organisation polic|policy[^\r\n]{0,120}(prohibit|deny|denied|block)|(?:prohibit|deny|denied|block)[^\r\n]{0,120}policy/.test(
      diagnostic,
    )
  ) {
    return "ACCESS_POLICY";
  }
  if (
    /permission denied|access denied|forbidden|not authorized|not authorised|not allowed|insufficient permission|\bpermission\b|\brole\b|ai\.languagemodels\.user/.test(
      diagnostic,
    )
  ) {
    return "IAM";
  }
  return "OTHER";
}

async function classifyYandexBadRequest(response: Response): Promise<YandexBadRequestCategory> {
  try {
    // Provider diagnostics may contain dynamic identifiers or request details. They are
    // consumed only in-memory and reduced to a fixed enum; raw content never escapes.
    const raw = await response.text();
    return classifyYandexBadRequestDiagnostic(raw);
  } catch {
    return "OTHER";
  }
}

async function classifyYandexForbidden(response: Response): Promise<YandexForbiddenCategory> {
  try {
    // As with 400 diagnostics, never expose or log the provider response. Reduce it
    // in-memory to a fixed operational category so staging can distinguish billing,
    // policy and IAM failures without leaking provider-controlled detail.
    const raw = await response.text();
    return classifyYandexForbiddenDiagnostic(raw);
  } catch {
    return "OTHER";
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
          "x-data-logging-enabled": "false",
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
      if (response.status === 400) {
        const category = await classifyYandexBadRequest(response);
        throw new Error(`${AI_PROVIDER_ERROR}:HTTP_400:${category}`);
      }
      if (response.status === 403) {
        const category = await classifyYandexForbidden(response);
        throw new Error(`${AI_PROVIDER_ERROR}:HTTP_403:${category}`);
      }
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
