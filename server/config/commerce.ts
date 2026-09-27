import type { CommercePricingCatalog } from "@/server/domain/commerce/contracts";

const CURRENCY = /^[A-Z]{3}$/;
const MAX_AMOUNT_MINOR = 2_000_000_000;
const MAX_OFFER_VERSION_LENGTH = 200;

function invalidConfig(name: string): never {
  throw new Error(`COMMERCE_CONFIG_INVALID:${name}`);
}

function parseOrigin(value: string | undefined) {
  const raw = value?.trim();
  if (!raw) invalidConfig("IB_COMMERCE_CHECKOUT_ORIGIN");

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    invalidConfig("IB_COMMERCE_CHECKOUT_ORIGIN");
  }

  const loopback =
    url.hostname === "localhost" ||
    url.hostname === "127.0.0.1" ||
    url.hostname === "[::1]";
  const protocolOk = url.protocol === "https:" || (loopback && url.protocol === "http:");
  const originOnly =
    url.origin === raw &&
    (url.pathname === "/" || url.pathname === "") &&
    !url.search &&
    !url.hash &&
    !url.username &&
    !url.password;

  if (!protocolOk || !originOnly) invalidConfig("IB_COMMERCE_CHECKOUT_ORIGIN");
  return url.origin;
}

function parseAmount(value: string | undefined, name: string) {
  const raw = value?.trim() ?? "";
  if (!/^[1-9]\d{0,9}$/.test(raw)) invalidConfig(name);
  const amount = Number(raw);
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > MAX_AMOUNT_MINOR) {
    invalidConfig(name);
  }
  return amount;
}

function parseCurrency(value: string | undefined) {
  const currency = value?.trim().toUpperCase() ?? "";
  if (!CURRENCY.test(currency)) invalidConfig("IB_COMMERCE_CURRENCY");
  return currency;
}

function parseOfferVersion(value: string | undefined) {
  const version = value?.trim() ?? "";
  if (
    !version ||
    version.length > MAX_OFFER_VERSION_LENGTH ||
    /[\r\n\0]/.test(version)
  ) {
    invalidConfig("IB_COMMERCE_OFFER_VERSION");
  }
  return version;
}

export type CommerceCheckoutRuntimeConfig = {
  allowedOrigin: string;
  catalog: CommercePricingCatalog;
};

export function readCommerceCheckoutRuntimeConfig(
  env: Record<string, string | undefined> = process.env,
): CommerceCheckoutRuntimeConfig {
  const currency = parseCurrency(env.IB_COMMERCE_CURRENCY);
  const offerVersion = parseOfferVersion(env.IB_COMMERCE_OFFER_VERSION);

  return {
    allowedOrigin: parseOrigin(env.IB_COMMERCE_CHECKOUT_ORIGIN),
    catalog: {
      LITE: {
        planCode: "LITE",
        amountMinor: parseAmount(
          env.IB_COMMERCE_LITE_AMOUNT_MINOR,
          "IB_COMMERCE_LITE_AMOUNT_MINOR",
        ),
        currency,
        offerVersion,
        active: true,
      },
      PRO: {
        planCode: "PRO",
        amountMinor: parseAmount(
          env.IB_COMMERCE_PRO_AMOUNT_MINOR,
          "IB_COMMERCE_PRO_AMOUNT_MINOR",
        ),
        currency,
        offerVersion,
        active: true,
      },
    },
  };
}
