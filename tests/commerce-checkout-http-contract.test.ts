import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { readCommerceCheckoutRuntimeConfig } from "@/server/config/commerce";
import {
  commerceCheckoutCorsHeaders,
  isAllowedCommerceCheckoutOrigin,
  parseCommerceCheckoutBody,
} from "@/server/domain/commerce/checkout-http";
import {
  COMMERCE_INVALID_INPUT,
} from "@/server/domain/commerce/contracts";

const env = {
  IB_COMMERCE_CHECKOUT_ORIGIN: "https://www.iburo127.ru",
  IB_COMMERCE_CURRENCY: "rub",
  IB_COMMERCE_OFFER_VERSION: "offer-2026-09-27",
  IB_COMMERCE_LITE_AMOUNT_MINOR: "799000",
  IB_COMMERCE_PRO_AMOUNT_MINOR: "2999000",
};

const config = readCommerceCheckoutRuntimeConfig(env);
assert.equal(config.allowedOrigin, "https://www.iburo127.ru");
assert.deepEqual(config.catalog.LITE, {
  planCode: "LITE",
  amountMinor: 799000,
  currency: "RUB",
  offerVersion: "offer-2026-09-27",
  active: true,
});
assert.deepEqual(config.catalog.PRO, {
  planCode: "PRO",
  amountMinor: 2999000,
  currency: "RUB",
  offerVersion: "offer-2026-09-27",
  active: true,
});

for (const [key, value] of [
  ["IB_COMMERCE_CHECKOUT_ORIGIN", "http://www.iburo127.ru"],
  ["IB_COMMERCE_CHECKOUT_ORIGIN", "https://www.iburo127.ru/path"],
  ["IB_COMMERCE_CURRENCY", "RURR"],
  ["IB_COMMERCE_LITE_AMOUNT_MINOR", "0"],
  ["IB_COMMERCE_PRO_AMOUNT_MINOR", "1.5"],
  ["IB_COMMERCE_OFFER_VERSION", ""],
] as const) {
  assert.throws(
    () => readCommerceCheckoutRuntimeConfig({ ...env, [key]: value }),
    /COMMERCE_CONFIG_INVALID/,
  );
}

for (const missing of Object.keys(env)) {
  const candidate = { ...env };
  delete candidate[missing as keyof typeof candidate];
  assert.throws(
    () => readCommerceCheckoutRuntimeConfig(candidate),
    /COMMERCE_CONFIG_INVALID/,
  );
}

const parsed = parseCommerceCheckoutBody({
  planCode: "LITE",
  email: "  Customer@Example.TEST  ",
  requestId: "550e8400-e29b-41d4-a716-446655440000",
});
assert.deepEqual(parsed, {
  planCode: "LITE",
  email: "customer@example.test",
  requestId: "550e8400-e29b-41d4-a716-446655440000",
});

for (const invalid of [
  null,
  [],
  {},
  { planCode: "INDIVIDUAL", email: "a@example.test", requestId: "550e8400-e29b-41d4-a716-446655440000" },
  { planCode: "LITE", email: "invalid", requestId: "550e8400-e29b-41d4-a716-446655440000" },
  { planCode: "LITE", email: "a@example.test" },
  { planCode: "LITE", email: "a@example.test", requestId: "not-a-uuid" },
  { planCode: "LITE", email: "a@example.test", requestId: "550e8400-e29b-41d4-a716-446655440000", amountMinor: 1 },
  { planCode: "LITE", email: "a@example.test", requestId: "550e8400-e29b-41d4-a716-446655440000", status: "PAID" },
  { planCode: "LITE", email: "a@example.test", requestId: "550e8400-e29b-41d4-a716-446655440000", role: "ADMIN" },
]) {
  assert.throws(
    () => parseCommerceCheckoutBody(invalid),
    new RegExp(COMMERCE_INVALID_INPUT),
  );
}

const allowedRequest = new Request("https://iburo127.online/api/public/commerce/checkout", {
  headers: { Origin: "https://www.iburo127.ru" },
});
const deniedRequest = new Request("https://iburo127.online/api/public/commerce/checkout", {
  headers: { Origin: "https://evil.example" },
});
assert.equal(
  isAllowedCommerceCheckoutOrigin(allowedRequest, "https://www.iburo127.ru"),
  true,
);
assert.equal(
  isAllowedCommerceCheckoutOrigin(deniedRequest, "https://www.iburo127.ru"),
  false,
);

const cors = commerceCheckoutCorsHeaders("https://www.iburo127.ru");
assert.equal(cors.get("access-control-allow-origin"), "https://www.iburo127.ru");
assert.equal(cors.get("access-control-allow-methods"), "POST, OPTIONS");
assert.equal(cors.get("access-control-allow-headers"), "Content-Type");
assert.equal(cors.get("access-control-allow-credentials"), null);
assert.equal(cors.get("vary"), "Origin");

const route = await readFile(
  resolve("app/api/public/commerce/checkout/route.ts"),
  "utf8",
);
const limiter = await readFile(
  resolve("server/commerce/checkout-rate-limit.ts"),
  "utf8",
);

assert.match(route, /CHECKOUT_BODY_MAX_BYTES = 4 \* 1024/);
assert.match(route, /readCommerceCheckoutRuntimeConfig/);
assert.match(route, /isAllowedCommerceCheckoutOrigin/);
assert.match(route, /enforceCommerceCheckoutRateLimit/);
assert.match(route, /readBoundedJsonBody/);
assert.match(route, /PrismaCommerceOrderRepository/);
assert.match(route, /status: order\.status/);
assert.match(route, /replayed: order\.replayed/);
assert.match(route, /order\.replayed \? 200 : 201/);
assert.match(route, /CHECKOUT_IDEMPOTENCY_CONFLICT/);
assert.match(route, /409/);
assert.doesNotMatch(route, /customerEmail:\s*order\./);
assert.doesNotMatch(route, /userId:\s*order\./);
assert.doesNotMatch(route, /clientCaseId:\s*order\./);
assert.doesNotMatch(route, /provider|webhook|merchant|role/i);

const rateIndex = route.indexOf("enforceCommerceCheckoutRateLimit");
const bodyIndex = route.indexOf("readBoundedJsonBody(request");
assert.ok(rateIndex >= 0 && bodyIndex > rateIndex, "rate limit must precede body parsing/DB work");

assert.match(limiter, /iburo:commerce-checkout:v1/);
assert.match(limiter, /COMMERCE_CHECKOUT_RATE_LIMIT_MAX = 8/);
assert.match(limiter, /createHmac\("sha256", secret\)/);
assert.match(limiter, /readBetterAuthRuntimeConfig/);
assert.doesNotMatch(limiter, /insert[\s\S]{0,300}clientIp/);

console.log("COMMERCE_CHECKOUT_HTTP_CONTRACT_PASS");
