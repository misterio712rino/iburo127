import "server-only";

export const AI_USAGE_CONFIG_ERROR = "AI_USAGE_CONFIG_ERROR";

export type AiUsageRuntimeConfig = {
  perMinute: number;
  perDay: number;
};

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
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${AI_USAGE_CONFIG_ERROR}:${name}`);
  }
  return value;
}

export function readAiUsageRuntimeConfig(
  env: NodeJS.ProcessEnv = process.env,
): AiUsageRuntimeConfig {
  return {
    perMinute: readBoundedInteger(env, "IB_AI_RATE_LIMIT_PER_MINUTE", 6, 1, 60),
    perDay: readBoundedInteger(env, "IB_AI_RATE_LIMIT_PER_DAY", 100, 1, 2_000),
  };
}
