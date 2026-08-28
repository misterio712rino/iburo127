import { createHash } from "node:crypto";
import type { Bitrix24WebhookConfig } from "@/server/integrations/bitrix24/core";

export const STAGING_BITRIX24_TARGET_GUARD = "STAGING_BITRIX24_TARGET_GUARD";

function fail(code: string): never {
  throw new Error(`${STAGING_BITRIX24_TARGET_GUARD}:${code}`);
}

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim();
  if (!value) fail(`MISSING_${name}`);
  return value;
}

function parseOrigin(value: string, code: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    fail(code);
  }
  if (
    parsed.protocol !== "https:" ||
    (parsed.pathname !== "/" && parsed.pathname !== "") ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash
  ) {
    fail(code);
  }
  return parsed;
}

function readTimeout(env: NodeJS.ProcessEnv): number {
  const raw = env.BITRIX24_REQUEST_TIMEOUT_MS?.trim();
  if (!raw) return 10_000;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1_000 || value > 30_000) {
    fail("INVALID_TIMEOUT");
  }
  return value;
}

export function bitrix24SecretFingerprint(secret: string): string {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}

export function assertStagingBitrix24Target(
  env: NodeJS.ProcessEnv,
): Bitrix24WebhookConfig {
  if (env.IB_BITRIX24_TARGET?.trim() !== "staging") fail("TARGET");

  const portal = parseOrigin(required(env, "BITRIX24_PORTAL_ORIGIN"), "PORTAL_ORIGIN");
  const expectedPortal = parseOrigin(
    required(env, "IB_STAGING_BITRIX24_PORTAL_ORIGIN"),
    "EXPECTED_PORTAL_ORIGIN",
  );
  if (portal.origin !== expectedPortal.origin) fail("PORTAL_MISMATCH");

  const allowedHost = required(env, "IB_BITRIX24_ALLOWED_HOST").toLowerCase();
  if (allowedHost !== expectedPortal.hostname.toLowerCase()) fail("ALLOWED_HOST_MISMATCH");

  const userId = required(env, "BITRIX24_WEBHOOK_USER_ID");
  const expectedUserId = required(env, "IB_STAGING_BITRIX24_WEBHOOK_USER_ID");
  if (!/^[1-9][0-9]{0,19}$/.test(userId) || userId !== expectedUserId) {
    fail("USER_MISMATCH");
  }

  const secret = required(env, "BITRIX24_WEBHOOK_SECRET");
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(secret)) fail("SECRET_FORMAT");
  const fingerprint = bitrix24SecretFingerprint(secret);
  const expectedFingerprint = required(env, "IB_STAGING_BITRIX24_WEBHOOK_SECRET_SHA256").toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(expectedFingerprint) || fingerprint !== expectedFingerprint) {
    fail("SECRET_MISMATCH");
  }

  const expectedConfirm = `BITRIX-VERIFY:${expectedPortal.hostname}:${expectedUserId}:${expectedFingerprint}`;
  if (env.IB_STAGING_BITRIX24_CONFIRM?.trim() !== expectedConfirm) fail("CONFIRMATION");

  return {
    portalOrigin: portal.origin,
    userId,
    webhookSecret: secret,
    requestTimeoutMs: readTimeout(env),
  };
}
