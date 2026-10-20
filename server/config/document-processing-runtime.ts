import "server-only";

import { PRODUCTION_CONFIG_ERROR } from "@/server/config/production";

function readInteger(env: Record<string, string | undefined>, name: string, fallback: number, min: number, max: number) {
  const raw = env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${PRODUCTION_CONFIG_ERROR}:${name}`);
  }
  return value;
}

export type DocumentProcessingRuntimeConfig = {
  leaseSeconds: number;
  maxAttempts: number;
  retryBaseSeconds: number;
  retryMaxSeconds: number;
};

export function readDocumentProcessingRuntimeConfig(
  env: Record<string, string | undefined> = process.env,
): DocumentProcessingRuntimeConfig {
  const retryBaseSeconds = readInteger(env, "IB_DOCUMENT_PROCESSING_RETRY_BASE_SECONDS", 60, 10, 3_600);
  const retryMaxSeconds = readInteger(env, "IB_DOCUMENT_PROCESSING_RETRY_MAX_SECONDS", 3_600, 10, 86_400);
  if (retryMaxSeconds < retryBaseSeconds) {
    throw new Error(`${PRODUCTION_CONFIG_ERROR}:IB_DOCUMENT_PROCESSING_RETRY_MAX_SECONDS`);
  }
  return {
    leaseSeconds: readInteger(env, "IB_DOCUMENT_PROCESSING_LEASE_SECONDS", 120, 60, 900),
    maxAttempts: readInteger(env, "IB_DOCUMENT_PROCESSING_MAX_ATTEMPTS", 3, 1, 20),
    retryBaseSeconds,
    retryMaxSeconds,
  };
}
