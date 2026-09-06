import { createHash, timingSafeEqual } from "node:crypto";

export const STAGING_YANDEX_AI_TARGET_GUARD = "STAGING_YANDEX_AI_TARGET_GUARD";

function fail(code: string): never {
  throw new Error(`${STAGING_YANDEX_AI_TARGET_GUARD}:${code}`);
}

function requireValue(env: Readonly<Record<string, string | undefined>>, name: string) {
  const value = env[name]?.trim();
  if (!value) fail(`MISSING_${name}`);
  if (/[\r\n\0]/.test(value)) fail(`INVALID_${name}`);
  return value;
}

function digest(value: string) {
  return createHash("sha256").update(value, "utf8").digest();
}

function safeEqual(left: string, right: string) {
  return timingSafeEqual(digest(left), digest(right));
}

export type StagingYandexAiTarget = {
  apiKey: string;
  folderId: string;
  model: string;
};

export function assertStagingYandexAiTarget(
  env: Readonly<Record<string, string | undefined>>,
): StagingYandexAiTarget {
  if (env.IB_RUNTIME_TARGET?.trim() !== "staging") fail("RUNTIME_TARGET_NOT_STAGING");
  if (env.IB_AI_TARGET?.trim() !== "staging") fail("TARGET_NOT_STAGING");
  if (env.IB_AI_PROVIDER?.trim().toLowerCase() !== "yandex") fail("PROVIDER_NOT_YANDEX");

  const apiKey = requireValue(env, "YANDEX_AI_API_KEY");
  const folderId = requireValue(env, "YANDEX_AI_FOLDER_ID");
  const model = requireValue(env, "IB_AI_YANDEX_MODEL");
  const expectedFolderId = requireValue(env, "IB_STAGING_YANDEX_AI_FOLDER_ID");
  const expectedModel = requireValue(env, "IB_STAGING_YANDEX_AI_MODEL");

  if (apiKey.length < 20) fail("INVALID_API_KEY");
  if (!/^[a-z0-9]{10,64}$/.test(folderId)) fail("INVALID_FOLDER_ID");
  if (!/^[a-z0-9]{10,64}$/.test(expectedFolderId)) fail("INVALID_EXPECTED_FOLDER_ID");
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*(?:\/[A-Za-z0-9][A-Za-z0-9._-]*)?$/.test(model)) {
    fail("INVALID_MODEL");
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*(?:\/[A-Za-z0-9][A-Za-z0-9._-]*)?$/.test(expectedModel)) {
    fail("INVALID_EXPECTED_MODEL");
  }

  if (!safeEqual(folderId, expectedFolderId)) fail("FOLDER_MISMATCH");
  if (!safeEqual(model, expectedModel)) fail("MODEL_MISMATCH");

  const expectedConfirmation = `YANDEX-AI-SMOKE:${expectedFolderId}:${expectedModel}`;
  const confirmation = env.IB_STAGING_YANDEX_AI_CONFIRM?.trim() ?? "";
  if (!confirmation || !safeEqual(confirmation, expectedConfirmation)) {
    fail("CONFIRMATION_MISMATCH");
  }

  return { apiKey, folderId, model };
}
