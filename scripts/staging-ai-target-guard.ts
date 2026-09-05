import { createHash, timingSafeEqual } from "node:crypto";

export const STAGING_AI_TARGET_GUARD = "STAGING_AI_TARGET_GUARD";

function fail(code: string): never {
  throw new Error(`${STAGING_AI_TARGET_GUARD}:${code}`);
}

function requireValue(env: Readonly<Record<string, string | undefined>>, name: string) {
  const value = env[name]?.trim();
  if (!value) fail(`MISSING_${name}`);
  return value;
}

function digest(value: string) {
  return createHash("sha256").update(value, "utf8").digest();
}

function sha256Hex(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function safeEqual(left: string, right: string) {
  return timingSafeEqual(digest(left), digest(right));
}

export type StagingAiTarget = {
  apiKey: string;
  model: string;
};

export function assertStagingAiTarget(
  env: Readonly<Record<string, string | undefined>>,
): StagingAiTarget {
  if (env.IB_RUNTIME_TARGET?.trim() !== "staging") fail("RUNTIME_TARGET_NOT_STAGING");
  if (env.IB_AI_TARGET?.trim() !== "staging") fail("TARGET_NOT_STAGING");

  const apiKey = requireValue(env, "OPENAI_API_KEY");
  const model = requireValue(env, "IB_AI_OPENAI_MODEL");
  const expectedModel = requireValue(env, "IB_STAGING_OPENAI_MODEL");
  const expectedFingerprint = requireValue(env, "IB_STAGING_OPENAI_KEY_SHA256").toLowerCase();

  if (!/^[a-f0-9]{64}$/.test(expectedFingerprint)) fail("INVALID_KEY_FINGERPRINT");
  if (!safeEqual(model, expectedModel)) fail("MODEL_MISMATCH");

  const actualFingerprint = sha256Hex(apiKey);
  if (!safeEqual(actualFingerprint, expectedFingerprint)) fail("KEY_MISMATCH");

  const expectedConfirmation = `AI-SMOKE:${model}:${expectedFingerprint}`;
  const confirmation = env.IB_STAGING_AI_CONFIRM?.trim() ?? "";
  if (!confirmation || !safeEqual(confirmation, expectedConfirmation)) {
    fail("CONFIRMATION_MISMATCH");
  }

  return { apiKey, model };
}
