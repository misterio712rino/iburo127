import "server-only";

import type { Bitrix24WebhookConfig } from "./core";

export const BITRIX24_CONFIG_ERROR = "BITRIX24_CONFIG_ERROR";

function fail(name: string): never {
  throw new Error(`${BITRIX24_CONFIG_ERROR}:${name}`);
}

function requireEnv(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim();
  if (!value) fail(name);
  return value;
}

function readTimeout(env: NodeJS.ProcessEnv): number {
  const raw = env.BITRIX24_REQUEST_TIMEOUT_MS?.trim();
  if (!raw) return 10_000;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1_000 || value > 30_000) {
    fail("BITRIX24_REQUEST_TIMEOUT_MS");
  }
  return value;
}

export function readBitrix24WebhookConfig(
  env: NodeJS.ProcessEnv = process.env,
): Bitrix24WebhookConfig {
  const portalOrigin = requireEnv(env, "BITRIX24_PORTAL_ORIGIN");
  let parsed: URL;
  try {
    parsed = new URL(portalOrigin);
  } catch {
    fail("BITRIX24_PORTAL_ORIGIN");
  }

  const originOnly =
    parsed.protocol === "https:" &&
    (parsed.pathname === "/" || parsed.pathname === "") &&
    !parsed.username &&
    !parsed.password &&
    !parsed.search &&
    !parsed.hash;
  if (!originOnly) fail("BITRIX24_PORTAL_ORIGIN");

  const allowedHost = requireEnv(env, "IB_BITRIX24_ALLOWED_HOST").toLowerCase();
  if (parsed.hostname.toLowerCase() !== allowedHost || /[/:?#@]/.test(allowedHost)) {
    fail("IB_BITRIX24_ALLOWED_HOST");
  }

  const userId = requireEnv(env, "BITRIX24_WEBHOOK_USER_ID");
  if (!/^[1-9][0-9]{0,19}$/.test(userId)) fail("BITRIX24_WEBHOOK_USER_ID");

  const webhookSecret = requireEnv(env, "BITRIX24_WEBHOOK_SECRET");
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(webhookSecret)) fail("BITRIX24_WEBHOOK_SECRET");

  return {
    portalOrigin: parsed.origin,
    userId,
    webhookSecret,
    requestTimeoutMs: readTimeout(env),
  };
}
