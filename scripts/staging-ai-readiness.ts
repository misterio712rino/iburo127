import { createHash } from "node:crypto";

export type StagingAiProvider = "openai" | "yandex";

export type StagingAiReadiness = {
  provider: StagingAiProvider | null;
  ready: boolean;
  requiredCount: number;
  configuredCount: number;
  missingOrPlaceholder: string[];
  invalidOrInconsistent: string[];
  networkAccessed: false;
  valuesPrinted: false;
};

type StagingEnvironment = Readonly<Record<string, string | undefined>>;

const OPENAI_REQUIREMENTS = [
  "IB_RUNTIME_TARGET",
  "IB_AI_TARGET",
  "OPENAI_API_KEY",
  "IB_AI_OPENAI_MODEL",
  "IB_STAGING_OPENAI_MODEL",
  "IB_STAGING_OPENAI_KEY_SHA256",
  "IB_STAGING_AI_CONFIRM",
] as const;

const YANDEX_REQUIREMENTS = [
  "IB_RUNTIME_TARGET",
  "IB_AI_TARGET",
  "IB_AI_PROVIDER",
  "YANDEX_AI_API_KEY",
  "YANDEX_AI_FOLDER_ID",
  "IB_AI_YANDEX_MODEL",
  "IB_STAGING_YANDEX_AI_FOLDER_ID",
  "IB_STAGING_YANDEX_AI_MODEL",
  "IB_STAGING_YANDEX_AI_CONFIRM",
] as const;

const PLACEHOLDER_PATTERNS = [
  /replace-with/i,
  /example\.com/i,
  /example\.net/i,
];

const OPENAI_MODEL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;
const YANDEX_MODEL_PATTERN =
  /^[A-Za-z0-9][A-Za-z0-9._-]*(?:\/[A-Za-z0-9][A-Za-z0-9._-]*)?$/;
const YANDEX_FOLDER_PATTERN = /^[a-z0-9]{10,64}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

function isConfigured(value: string | undefined): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return !PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(trimmed));
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function readProvider(env: StagingEnvironment): StagingAiProvider | null {
  const raw = env.IB_AI_PROVIDER?.trim().toLowerCase();
  if (!raw) return "openai";
  if (raw === "openai" || raw === "yandex") return raw;
  return null;
}

function configuredFingerprint(value: string | undefined): string | null {
  if (!isConfigured(value)) return null;
  const normalized = value!.trim().toLowerCase();
  return SHA256_PATTERN.test(normalized) ? normalized : null;
}

function isAcceptedYandexConfirmation(value: string, expected: string): boolean {
  if (value === expected) return true;

  // Migration compatibility only. The legacy 64-hex suffix is not compared
  // with, or derived from, the current Yandex API key.
  const legacyPrefix = `${expected}:`;
  return value.startsWith(legacyPrefix) && SHA256_PATTERN.test(value.slice(legacyPrefix.length));
}

function markBoundedInteger(
  env: StagingEnvironment,
  invalid: Set<string>,
  name: string,
  min: number,
  max: number,
): void {
  if (!isConfigured(env[name])) return;
  const value = Number(env[name]!.trim());
  if (!Number.isInteger(value) || value < min || value > max) invalid.add(name);
}

function validateCommonTargets(env: StagingEnvironment, invalid: Set<string>): void {
  if (isConfigured(env.IB_RUNTIME_TARGET) && env.IB_RUNTIME_TARGET?.trim() !== "staging") {
    invalid.add("IB_RUNTIME_TARGET");
  }
  if (isConfigured(env.IB_AI_TARGET) && env.IB_AI_TARGET?.trim() !== "staging") {
    invalid.add("IB_AI_TARGET");
  }
}

function validateOpenAi(env: StagingEnvironment, invalid: Set<string>): void {
  validateCommonTargets(env, invalid);

  if (isConfigured(env.IB_AI_PROVIDER) && env.IB_AI_PROVIDER?.trim().toLowerCase() !== "openai") {
    invalid.add("IB_AI_PROVIDER");
  }

  if (isConfigured(env.OPENAI_API_KEY)) {
    const apiKey = env.OPENAI_API_KEY!.trim();
    if (apiKey.length < 20 || /[\r\n\0]/.test(apiKey)) invalid.add("OPENAI_API_KEY");
  }

  for (const name of ["IB_AI_OPENAI_MODEL", "IB_STAGING_OPENAI_MODEL"] as const) {
    if (isConfigured(env[name]) && !OPENAI_MODEL_PATTERN.test(env[name]!.trim())) invalid.add(name);
  }

  if (
    isConfigured(env.IB_AI_OPENAI_MODEL) &&
    isConfigured(env.IB_STAGING_OPENAI_MODEL) &&
    env.IB_AI_OPENAI_MODEL!.trim() !== env.IB_STAGING_OPENAI_MODEL!.trim()
  ) {
    invalid.add("IB_AI_OPENAI_MODEL");
    invalid.add("IB_STAGING_OPENAI_MODEL");
  }

  const fingerprint = configuredFingerprint(env.IB_STAGING_OPENAI_KEY_SHA256);
  if (isConfigured(env.IB_STAGING_OPENAI_KEY_SHA256) && !fingerprint) {
    invalid.add("IB_STAGING_OPENAI_KEY_SHA256");
  }
  if (
    fingerprint &&
    isConfigured(env.OPENAI_API_KEY) &&
    sha256Hex(env.OPENAI_API_KEY!.trim()) !== fingerprint
  ) {
    invalid.add("OPENAI_API_KEY");
    invalid.add("IB_STAGING_OPENAI_KEY_SHA256");
  }
  if (fingerprint && isConfigured(env.IB_AI_OPENAI_MODEL)) {
    const expected = `AI-SMOKE:${env.IB_AI_OPENAI_MODEL!.trim()}:${fingerprint}`;
    if (isConfigured(env.IB_STAGING_AI_CONFIRM) && env.IB_STAGING_AI_CONFIRM!.trim() !== expected) {
      invalid.add("IB_STAGING_AI_CONFIRM");
    }
  }

  markBoundedInteger(env, invalid, "IB_AI_OPENAI_REQUEST_TIMEOUT_MS", 1_000, 60_000);
}

function validateYandex(env: StagingEnvironment, invalid: Set<string>): void {
  validateCommonTargets(env, invalid);

  if (env.IB_AI_PROVIDER?.trim().toLowerCase() !== "yandex") invalid.add("IB_AI_PROVIDER");

  if (isConfigured(env.YANDEX_AI_API_KEY)) {
    const apiKey = env.YANDEX_AI_API_KEY!.trim();
    if (apiKey.length < 20 || /[\r\n\0]/.test(apiKey)) invalid.add("YANDEX_AI_API_KEY");
  }

  for (const name of ["YANDEX_AI_FOLDER_ID", "IB_STAGING_YANDEX_AI_FOLDER_ID"] as const) {
    if (isConfigured(env[name]) && !YANDEX_FOLDER_PATTERN.test(env[name]!.trim())) invalid.add(name);
  }
  if (
    isConfigured(env.YANDEX_AI_FOLDER_ID) &&
    isConfigured(env.IB_STAGING_YANDEX_AI_FOLDER_ID) &&
    env.YANDEX_AI_FOLDER_ID!.trim() !== env.IB_STAGING_YANDEX_AI_FOLDER_ID!.trim()
  ) {
    invalid.add("YANDEX_AI_FOLDER_ID");
    invalid.add("IB_STAGING_YANDEX_AI_FOLDER_ID");
  }

  for (const name of ["IB_AI_YANDEX_MODEL", "IB_STAGING_YANDEX_AI_MODEL"] as const) {
    if (isConfigured(env[name]) && !YANDEX_MODEL_PATTERN.test(env[name]!.trim())) invalid.add(name);
  }
  if (
    isConfigured(env.IB_AI_YANDEX_MODEL) &&
    isConfigured(env.IB_STAGING_YANDEX_AI_MODEL) &&
    env.IB_AI_YANDEX_MODEL!.trim() !== env.IB_STAGING_YANDEX_AI_MODEL!.trim()
  ) {
    invalid.add("IB_AI_YANDEX_MODEL");
    invalid.add("IB_STAGING_YANDEX_AI_MODEL");
  }

  if (
    isConfigured(env.IB_STAGING_YANDEX_AI_FOLDER_ID) &&
    isConfigured(env.IB_STAGING_YANDEX_AI_MODEL)
  ) {
    const expected = `YANDEX-AI-SMOKE:${env.IB_STAGING_YANDEX_AI_FOLDER_ID!.trim()}:${env.IB_STAGING_YANDEX_AI_MODEL!.trim()}`;
    if (
      isConfigured(env.IB_STAGING_YANDEX_AI_CONFIRM) &&
      !isAcceptedYandexConfirmation(env.IB_STAGING_YANDEX_AI_CONFIRM!.trim(), expected)
    ) {
      invalid.add("IB_STAGING_YANDEX_AI_CONFIRM");
    }
  }

  markBoundedInteger(env, invalid, "IB_AI_YANDEX_REQUEST_TIMEOUT_MS", 1_000, 60_000);
  markBoundedInteger(env, invalid, "IB_AI_YANDEX_MAX_OUTPUT_TOKENS", 128, 4_000);
}

export function buildProviderAwareStagingAiReadiness(
  env: StagingEnvironment,
): StagingAiReadiness {
  const provider = readProvider(env);
  if (!provider) {
    return {
      provider: null,
      ready: false,
      requiredCount: 1,
      configuredCount: isConfigured(env.IB_AI_PROVIDER) ? 1 : 0,
      missingOrPlaceholder: isConfigured(env.IB_AI_PROVIDER) ? [] : ["IB_AI_PROVIDER"],
      invalidOrInconsistent: isConfigured(env.IB_AI_PROVIDER) ? ["IB_AI_PROVIDER"] : [],
      networkAccessed: false,
      valuesPrinted: false,
    };
  }

  const requirements = provider === "yandex" ? YANDEX_REQUIREMENTS : OPENAI_REQUIREMENTS;
  const missingOrPlaceholder = requirements.filter((name) => !isConfigured(env[name]));
  const invalid = new Set<string>();

  if (provider === "yandex") validateYandex(env, invalid);
  else validateOpenAi(env, invalid);

  const invalidOrInconsistent = [...invalid].sort();
  return {
    provider,
    ready: missingOrPlaceholder.length === 0 && invalidOrInconsistent.length === 0,
    requiredCount: requirements.length,
    configuredCount: requirements.length - missingOrPlaceholder.length,
    missingOrPlaceholder: [...missingOrPlaceholder],
    invalidOrInconsistent,
    networkAccessed: false,
    valuesPrinted: false,
  };
}
