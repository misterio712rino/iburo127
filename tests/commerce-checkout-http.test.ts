import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  COMMERCE_CHECKOUT_CONFIG_ERROR,
  readCommerceCheckoutRuntimeConfig,
} from "@/server/commerce/runtime";
import { parseCommerceCheckoutRequest } from "@/server/commerce/checkout-request";
import { COMMERCE_INVALID_INPUT } from "@/server/domain/commerce/contracts";

function expectConfigError(env: NodeJS.ProcessEnv, name: string) {
  assert.throws(
    () => readCommerceCheckoutRuntimeConfig(env),
    new RegExp(`^${COMMERCE_CHECKOUT_CONFIG_ERROR}:${name}$`),
  );
}

expectConfigError({}, "IB_COMMERCE_CHECKOUT_ENABLED");
expectConfigError(
  { IB_COMMERCE_CHECKOUT_ENABLED: "false" },
  "IB_COMMERCE_CHECKOUT_ENABLED",
);

const validEnv: NodeJS.ProcessEnv = {
  IB_COMMERCE_CHECKOUT_ENABLED: "true",
  IB_COMMERCE_MARKETING_ORIGIN: "https://www.iburo127.ru",
  IB_COMMERCE_LITE_AMOUNT_MINOR: "799000",
  IB_COMMERCE_PRO_AMOUNT_MINOR: "2999000",
  IB_COMMERCE_CURRENCY: "rub",
  IB_COMMERCE_OFFER_VERSION: "offer-2026-09-27-v1",
};

const config = readCommerceCheckoutRuntimeConfig(validEnv);
assert.equal(config.marketingOrigin, "https://www.iburo127.ru");
assert.deepEqual(config.catalog.LITE, {
  planCode: "LITE",
  amountMinor: 799000,
  currency: "RUB",
  offerVersion: "offer-2026-09-27-v1",
  active: true,
});
assert.deepEqual(config.catalog.PRO, {
  planCode: "PRO",
  amountMinor: 2999000,
  currency: "RUB",
  offerVersion: "offer-2026-09-27-v1",
  active: true,
});

for (const [name, value] of [
  ["IB_COMMERCE_MARKETING_ORIGIN", "http://www.iburo127.ru"],
  ["IB_COMMERCE_MARKETING_ORIGIN", "https://www.iburo127.ru/path"],
  ["IB_COMMERCE_LITE_AMOUNT_MINOR", "0"],
  ["IB_COMMERCE_LITE_AMOUNT_MINOR", "799000.5"],
  ["IB_COMMERCE_PRO_AMOUNT_MINOR", "99999999999"],
  ["IB_COMMERCE_CURRENCY", "RU"],
  ["IB_COMMERCE_OFFER_VERSION", "x".repeat(201)],
] as const) {
  expectConfigError({ ...validEnv, [name]: value }, name);
}

assert.deepEqual(
  parseCommerceCheckoutRequest({
    planCode: "LITE",
    customerEmail: "buyer@example.test",
  }),
  {
    planCode: "LITE",
    customerEmail: "buyer@example.test",
  },
);

for (const invalid of [
  null,
  [],
  {},
  { planCode: "LITE" },
  { customerEmail: "buyer@example.test" },
  {
    planCode: "LITE",
    customerEmail: "buyer@example.test",
    amountMinor: 1,
  },
  {
    planCode: "LITE",
    customerEmail: "buyer@example.test",
    currency: "RUB",
  },
  {
    planCode: "LITE",
    customerEmail: "buyer@example.test",
    status: "PAID",
  },
]) {
  assert.throws(
    () => parseCommerceCheckoutRequest(invalid),
    new RegExp(COMMERCE_INVALID_INPUT),
  );
}

const route = readFileSync(
  resolve(process.cwd(), "app/api/public/commerce/checkout/route.ts"),
  "utf8",
);
const rateLimit = readFileSync(
  resolve(process.cwd(), "server/commerce/checkout-rate-limit.ts"),
  "utf8",
);

assert.match(route, /CHECKOUT_BODY_MAX_BYTES = 4 \* 1024/);
assert.match(route, /readBoundedJsonBody\(request, CHECKOUT_BODY_MAX_BYTES\)/);
assert.match(route, /configuredRequestOrigin\(request, config\.marketingOrigin\)/);
assert.match(route, /Access-Control-Allow-Origin/);
assert.match(route, /Access-Control-Allow-Methods.*POST, OPTIONS/);
assert.match(route, /Access-Control-Allow-Headers.*Content-Type/);
assert.match(route, /paymentProviderReady: false/);
assert.match(route, /status: order\.status/);
assert.match(route, /catalog: config\.catalog/);
assert.doesNotMatch(route, /amountMinor:\s*input\./);
assert.doesNotMatch(route, /currency:\s*input\./);
assert.doesNotMatch(route, /offerVersion:\s*input\./);
assert.doesNotMatch(route, /status:\s*input\./);
assert.doesNotMatch(route, /userId:\s*input\./);
assert.doesNotMatch(route, /clientCaseId:\s*input\./);
assert.doesNotMatch(route, /paidAt:\s*input\./);

assert.match(rateLimit, /iburo:commerce-checkout:v1/);
assert.match(rateLimit, /COMMERCE_CHECKOUT_RATE_LIMIT_MAX = 8/);
assert.match(rateLimit, /createHmac\("sha256", secret\)/);
assert.doesNotMatch(rateLimit, /customerEmail/);

console.log("COMMERCE_CHECKOUT_HTTP_CONTRACT_PASS");
