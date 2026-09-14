const PROVIDER_ERROR_PREFIX = "AI_PROVIDER_ERROR:";
const PROVIDER_CONFIG_PREFIX = "AI_PROVIDER_CONFIG_ERROR:";
const USAGE_CONFIG_PREFIX = "AI_USAGE_CONFIG_ERROR:";
const PRODUCTION_CONFIG_PREFIX = "PRODUCTION_CONFIG_ERROR:";

const FIXED_PROVIDER_DETAILS = new Set([
  "INVALID_CONFIG",
  "INVALID_SAFETY_IDENTIFIER",
  "TIMEOUT",
  "NETWORK",
  "INVALID_RESPONSE",
  "EMPTY_RESPONSE",
  "CONTENT_FILTERED",
  "RESPONSE_INCOMPLETE",
]);

const FIXED_HTTP_400_CATEGORIES = new Set([
  "SCOPE",
  "MODEL",
  "FOLDER_NOT_FOUND",
  "FOLDER_ACCESS",
  "FOLDER_ID",
  "FOLDER",
  "MAX_TOKENS",
  "TEMPERATURE",
  "MESSAGES",
  "OPTIONS",
  "REQUEST",
  "OTHER",
]);

const FIXED_HTTP_403_CATEGORIES = new Set([
  "BILLING_SUSPENDED",
  "BILLING",
  "SERVICE_ACCOUNT_SUSPENDED",
  "ACCESS_POLICY",
  "SCOPE",
  "IAM",
  "OTHER",
]);

function errorCode(error: unknown): string {
  return error instanceof Error ? error.message : "";
}

function classifyProviderDetail(detail: string): string {
  if (FIXED_PROVIDER_DETAILS.has(detail)) return `PROVIDER_${detail}`;

  const httpWithCategory = /^HTTP_(\d{3}):([A-Z_]+)$/.exec(detail);
  if (httpWithCategory) {
    const [, status, category] = httpWithCategory;
    if (
      (status === "400" && FIXED_HTTP_400_CATEGORIES.has(category)) ||
      (status === "403" && FIXED_HTTP_403_CATEGORIES.has(category))
    ) {
      return `PROVIDER_HTTP_${status}_${category}`;
    }
    return "PROVIDER_OTHER";
  }

  const httpOnly = /^HTTP_(\d{3})$/.exec(detail);
  if (httpOnly) return `PROVIDER_HTTP_${httpOnly[1]}`;

  if (/^RESPONSE_(?:INCOMPLETE|FAILED|CANCELLED|QUEUED|IN_PROGRESS)$/.test(detail)) {
    return `PROVIDER_${detail}`;
  }
  return "PROVIDER_OTHER";
}

/**
 * Reduce operational AI failures to a fixed, non-sensitive category. Never
 * return the original error string: provider diagnostics, request data, env
 * names, identifiers and secrets must not escape through this channel.
 */
export function classifyAiOperationalFailure(error: unknown): string | null {
  const code = errorCode(error);
  if (code === "AI_AUDIT_FAILED") return "AUDIT";
  if (code === "AI_MODEL_RESPONSE_INVALID") return "MODEL_RESPONSE_INVALID";
  if (code.startsWith(PROVIDER_ERROR_PREFIX)) {
    return classifyProviderDetail(code.slice(PROVIDER_ERROR_PREFIX.length));
  }
  if (code.startsWith(PROVIDER_CONFIG_PREFIX)) return "PROVIDER_CONFIG";
  if (code.startsWith(USAGE_CONFIG_PREFIX)) return "USAGE_CONFIG";
  if (code.startsWith(PRODUCTION_CONFIG_PREFIX)) return "PRODUCTION_CONFIG";
  return null;
}

export function stagingAiOperationalDiagnostic(
  error: unknown,
  runtimeTarget: string | undefined,
): string | null {
  if (runtimeTarget?.trim().toLowerCase() !== "staging") return null;
  return classifyAiOperationalFailure(error) ?? "UNAVAILABLE_OTHER";
}
