import "server-only";

import type { CommercePricingCatalog } from "@/server/domain/commerce/contracts";

export const COMMERCE_CHECKOUT_CONFIG_ERROR = "COMMERCE_CHECKOUT_CONFIG_ERROR";

export type CommerceCheckoutRuntimeConfig = {
  marketingOrigin: string;
  catalog: CommercePricingCatalog;
};

function fail(name: string): never {
  throw new Error(`${COMMERCE_CHECKOUT_CONFIG_ERROR}:${name}`);
}

function requireEnv(env: NodeJS.ProcessEnv, name: string) {
  const value = env[name]?.trim();
  if (!value) fail(name);
  if (/[
\0]/.test(value)) fail(name);
  return value;
}

function requireEnabled(env: NodeJS.ProcessEnv) {
  if (requireEnv(env, "IB_COMMERCE_CHECKOUT_ENABLED") !== "true") {
    fail("IB_COMMERCE_CHECKOUT_ENABLED");
  }
}

function requireAmountMinor(env: NodeJS.ProcessEnv, name: string) {
  const raw = requireEnv(env, name);
  if (!/^[1-9]\d{0,9}$/.test(raw)) fail(name);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1 || value > 2_000_000_000) {
    fail(name);
  }
  return value;
}

function requireCurrency(env: NodeJS.ProcessEnv) {
  const value = requireEnv(env, "IB_COMMERCE_CURRENCY").toUpperCase();
  if (!/^[A-Z]{3}$/.test(value)) fail("IB_COMMERCE_CURRENCY");
  return value;
}

function requireOfferVersion(env: NodeJS.ProcessEnv) {
  const value = requireEnv(env, "IB_COMMERCE_OFFER_VERSION");
  if (value.length > 200) fail("IB_COMMERCE_OFFER_VERSION");
  return value;
}

function requireHttpsOrigin(env: NodeJS.ProcessEnv) {
  const raw = requireEnv(env, "IB_COMMERCE_MARKETING_ORIGIN");
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    fail("IB_COMMERCE_MARKETING_ORIGIN");
  }
  const originOnly =
    parsed.protocol === "https:" &&
    (parsed.pathname === "/" || parsed.pathname === "") &&
    !parsed.search &&
    !parsed.hash &&
    !parsed.username &&
    !parsed.password;
  if (!originOnly) fail("IB_COMMERCE_MARKETING_ORIGIN");
  return parsed.origin;
}

export function readCommerceCheckoutRuntimeConfig(
  env: NodeJS.ProcessEnv = process.env,
): CommerceCheckoutRuntimeConfig {
  requireEnabled(env);
  const currency = requireCurrency(env);
  const offerVersion = requireOfferVersion(env);

  return {
    marketingOrigin: requireHttpsOrigin(env),
    catalog: {
      LITE: {
        planCode: "LITE",
        amountMinor: requireAmountMinor(env, "IB_COMMERCE_LITE_AMOUNT_MINOR"),
        currency,
        offerVersion,
        active: true,
      },
      PRO: {
        planCode: "PRO",
        amountMinor: requireAmountMinor(env, "IB_COMMERCE_PRO_AMOUNT_MINOR"),
        currency,
        offerVersion,
        active: true,
      },
    },
  };
}
