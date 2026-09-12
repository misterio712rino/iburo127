export const BITRIX24_REQUEST_FAILED = "BITRIX24_REQUEST_FAILED";

export const BITRIX24_METHODS = [
  "profile",
  "method.get",
  "crm.item.get",
  "crm.item.list",
  "crm.item.fields",
  "crm.item.add",
  "crm.item.update",
] as const;

export type Bitrix24Method = (typeof BITRIX24_METHODS)[number];

export type Bitrix24WebhookConfig = {
  portalOrigin: string;
  userId: string;
  webhookSecret: string;
  requestTimeoutMs: number;
};

export type Bitrix24Fetch = (
  input: string | URL,
  init?: RequestInit,
) => Promise<Response>;

export type Bitrix24ItemFieldDescription = {
  type: string;
  isRequired: boolean;
  isReadOnly: boolean;
  isImmutable: boolean;
};

const METHOD_SET = new Set<string>(BITRIX24_METHODS);
const MAX_REQUEST_BYTES = 512 * 1024;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

function fail(code: string): never {
  throw new Error(`${BITRIX24_REQUEST_FAILED}:${code}`);
}

function assertConfig(config: Bitrix24WebhookConfig): Bitrix24WebhookConfig {
  let parsed: URL;
  try {
    parsed = new URL(config.portalOrigin);
  } catch {
    fail("INVALID_CONFIG");
  }

  const originOnly =
    parsed.protocol === "https:" &&
    parsed.origin === config.portalOrigin.replace(/\/$/, "") &&
    (parsed.pathname === "/" || parsed.pathname === "") &&
    !parsed.username &&
    !parsed.password &&
    !parsed.search &&
    !parsed.hash;
  const validUserId = /^[1-9][0-9]{0,19}$/.test(config.userId);
  const validSecret = /^[A-Za-z0-9_-]{8,128}$/.test(config.webhookSecret);
  const validTimeout =
    Number.isInteger(config.requestTimeoutMs) &&
    config.requestTimeoutMs >= 1_000 &&
    config.requestTimeoutMs <= 30_000;

  if (!originOnly || !validUserId || !validSecret || !validTimeout) {
    fail("INVALID_CONFIG");
  }

  return {
    portalOrigin: parsed.origin,
    userId: config.userId,
    webhookSecret: config.webhookSecret,
    requestTimeoutMs: config.requestTimeoutMs,
  };
}

function safeProviderCode(value: unknown): string {
  if (typeof value !== "string") return "UNKNOWN";
  const normalized = value.toUpperCase().replace(/[^A-Z0-9_-]/g, "_").slice(0, 80);
  return normalized || "UNKNOWN";
}

function serializeParams(params: unknown): string {
  let payload: string;
  try {
    payload = JSON.stringify(params ?? {});
  } catch {
    fail("INVALID_REQUEST");
  }
  if (Buffer.byteLength(payload, "utf8") > MAX_REQUEST_BYTES) fail("REQUEST_TOO_LARGE");
  return payload;
}

function parseResponse(text: string): Record<string, unknown> {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    fail("INVALID_RESPONSE");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail("INVALID_RESPONSE");
  }
  const record = value as Record<string, unknown>;
  if (record.error) fail(`PROVIDER_${safeProviderCode(record.error)}`);
  return record;
}

export async function callBitrix24Webhook(
  config: Bitrix24WebhookConfig,
  method: Bitrix24Method,
  params: unknown = {},
  fetchImpl: Bitrix24Fetch = fetch,
): Promise<Record<string, unknown>> {
  const safeConfig = assertConfig(config);
  if (!METHOD_SET.has(method)) fail("METHOD_NOT_ALLOWED");
  const payload = serializeParams(params);

  const requestUrl = new URL(
    `/rest/${safeConfig.userId}/${safeConfig.webhookSecret}/${method}`,
    safeConfig.portalOrigin,
  );
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), safeConfig.requestTimeoutMs);

  let response: Response;
  try {
    response = await fetchImpl(requestUrl, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: payload,
      cache: "no-store",
      signal: controller.signal,
    });
  } catch {
    if (controller.signal.aborted) fail("TIMEOUT");
    fail("NETWORK");
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) fail(`HTTP_${response.status}`);

  let text: string;
  try {
    text = await response.text();
  } catch {
    fail("INVALID_RESPONSE");
  }
  if (Buffer.byteLength(text, "utf8") > MAX_RESPONSE_BYTES) fail("RESPONSE_TOO_LARGE");
  return parseResponse(text);
}

export async function getBitrix24ProfileIdentity(
  config: Bitrix24WebhookConfig,
  fetchImpl: Bitrix24Fetch = fetch,
): Promise<{ id: string; admin: boolean }> {
  const response = await callBitrix24Webhook(config, "profile", {}, fetchImpl);
  const result = response.result;
  if (!result || typeof result !== "object" || Array.isArray(result)) fail("INVALID_RESPONSE");
  const record = result as Record<string, unknown>;
  if (typeof record.ID !== "string" || !/^[1-9][0-9]{0,19}$/.test(record.ID)) {
    fail("INVALID_RESPONSE");
  }
  if (typeof record.ADMIN !== "boolean") fail("INVALID_RESPONSE");
  return { id: record.ID, admin: record.ADMIN };
}

export async function getBitrix24MethodAvailability(
  config: Bitrix24WebhookConfig,
  name: "crm.item.add" | "crm.item.update" | "crm.item.get" | "crm.item.list",
  fetchImpl: Bitrix24Fetch = fetch,
): Promise<{ isExisting: boolean; isAvailable: boolean }> {
  const response = await callBitrix24Webhook(config, "method.get", { name }, fetchImpl);
  const result = response.result;
  if (!result || typeof result !== "object" || Array.isArray(result)) fail("INVALID_RESPONSE");
  const record = result as Record<string, unknown>;
  if (typeof record.isExisting !== "boolean" || typeof record.isAvailable !== "boolean") {
    fail("INVALID_RESPONSE");
  }
  return {
    isExisting: record.isExisting,
    isAvailable: record.isAvailable,
  };
}

export async function getBitrix24ItemFields(
  config: Bitrix24WebhookConfig,
  entityTypeId: number,
  fetchImpl: Bitrix24Fetch = fetch,
): Promise<Record<string, Bitrix24ItemFieldDescription>> {
  if (!Number.isSafeInteger(entityTypeId) || entityTypeId < 1 || entityTypeId > 2_147_483_647) {
    fail("INVALID_REQUEST");
  }

  const response = await callBitrix24Webhook(
    config,
    "crm.item.fields",
    { entityTypeId, useOriginalUfNames: "N" },
    fetchImpl,
  );
  const result = response.result;
  if (!result || typeof result !== "object" || Array.isArray(result)) fail("INVALID_RESPONSE");
  const fields = (result as Record<string, unknown>).fields;
  if (!fields || typeof fields !== "object" || Array.isArray(fields)) fail("INVALID_RESPONSE");

  const safeFields: Record<string, Bitrix24ItemFieldDescription> = {};
  for (const [name, value] of Object.entries(fields as Record<string, unknown>)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) fail("INVALID_RESPONSE");
    const field = value as Record<string, unknown>;
    if (
      typeof field.type !== "string" ||
      typeof field.isRequired !== "boolean" ||
      typeof field.isReadOnly !== "boolean" ||
      typeof field.isImmutable !== "boolean"
    ) {
      fail("INVALID_RESPONSE");
    }
    safeFields[name] = {
      type: field.type,
      isRequired: field.isRequired,
      isReadOnly: field.isReadOnly,
      isImmutable: field.isImmutable,
    };
  }

  return safeFields;
}
