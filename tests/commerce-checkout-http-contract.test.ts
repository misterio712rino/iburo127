import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { readCommerceCheckoutRuntimeConfig } from "@/server/config/commerce";
import {
  commerceCheckoutCorsHeaders,
  isAllowedCommerceCheckoutOrigin,
  parseCommerceCheckoutBody,
} from "@/server/domain/commerce/checkout-http";
import { COMMERCE_INVALID_INPUT } from "@/server/domain/commerce/contracts";

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
  assert.throws(() => readCommerceCheckoutRuntimeConfig({ ...env, [key]: value }), /COMMERCE_CONFIG_INVALID/);
}

for (const missing of Object.keys(env)) {
  const candidate = { ...env };
  delete candidate[missing as keyof typeof candidate];
  assert.throws(() => readCommerceCheckoutRuntimeConfig(candidate), /COMMERCE_CONFIG_INVALID/);
}

const clientCaseId = "550e8400-e29b-41d4-a716-446655440000";
const requestId = "550e8400-e29b-41d4-a716-446655440001";
assert.deepEqual(parseCommerceCheckoutBody({ clientCaseId, planCode: "LITE", requestId }), {
  clientCaseId,
  planCode: "LITE",
  requestId,
});

for (const invalid of [
  null,
  [],
  {},
  { clientCaseId, planCode: "INDIVIDUAL", requestId },
  { clientCaseId: "not-a-uuid", planCode: "LITE", requestId },
  { clientCaseId, planCode: "LITE", requestId: "not-a-uuid" },
  { clientCaseId, planCode: "LITE", requestId, email: "client@example.test" },
  { clientCaseId, planCode: "LITE", requestId, amountMinor: 1 },
  { clientCaseId, planCode: "LITE", requestId, status: "PAID" },
  { clientCaseId, planCode: "LITE", requestId, role: "ADMIN" },
]) {
  assert.throws(() => parseCommerceCheckoutBody(invalid), new RegExp(COMMERCE_INVALID_INPUT));
}

const allowedRequest = new Request("https://iburo127.online/api/public/commerce/checkout", {
  headers: { Origin: "https://www.iburo127.ru" },
});
const deniedRequest = new Request("https://iburo127.online/api/public/commerce/checkout", {
  headers: { Origin: "https://evil.example" },
});
assert.equal(isAllowedCommerceCheckoutOrigin(allowedRequest, "https://www.iburo127.ru"), true);
assert.equal(isAllowedCommerceCheckoutOrigin(deniedRequest, "https://www.iburo127.ru"), false);

const cors = commerceCheckoutCorsHeaders("https://www.iburo127.ru");
assert.equal(cors.get("access-control-allow-origin"), "https://www.iburo127.ru");
assert.equal(cors.get("access-control-allow-methods"), "POST, OPTIONS");
assert.equal(cors.get("access-control-allow-headers"), "Content-Type");
assert.equal(cors.get("access-control-allow-credentials"), null);
assert.equal(cors.get("vary"), "Origin");

const route = await readFile(resolve("app/api/public/commerce/checkout/route.ts"), "utf8");
const clientCheckout = await readFile(resolve("components/portal/ClientPlanUpgradeCheckout.tsx"), "utf8");
const stripeGateway = await readFile(resolve("server/commerce/stripe-checkout-gateway.ts"), "utf8");
const webhookRoute = await readFile(resolve("app/api/public/commerce/webhook/route.ts"), "utf8");
const paymentRepository = await readFile(resolve("server/repositories/prisma/commerce-payment-event-repository.ts"), "utf8");
const migration = await readFile(resolve("prisma/migrations/20261007_commerce_stripe_checkout/migration.sql"), "utf8");
const checkoutSessionRecoveryMigration = await readFile(
  resolve("prisma/migrations/20261008_commerce_checkout_session_recovery/migration.sql"),
  "utf8",
);
const limiter = await readFile(resolve("server/commerce/checkout-rate-limit.ts"), "utf8");

assert.match(route, /CHECKOUT_BODY_MAX_BYTES = 4 \* 1024/);
assert.match(route, /requireServerActor/);
assert.match(route, /requireRole\(actor, "CLIENT"\)/);
assert.match(route, /PrismaCommerceCaseCheckoutRepository/);
assert.match(route, /CommerceCheckoutService/);
assert.match(route, /CHECKOUT_IDEMPOTENCY_CONFLICT/);
assert.ok(
  route.includes("code === COMMERCE_CHECKOUT_NO_LONGER_PENDING") &&
    route.includes("code === COMMERCE_CHECKOUT_SESSION_RECOVERY_REQUIRED") &&
    route.includes("{ ok: false, error: { code } }, 409"),
  "terminal checkout replay and ambiguous session recovery must return specific conflicts",
);
assert.match(route, /COMMERCE_CASE_CHECKOUT_PENDING/);
assert.ok(clientCheckout.includes("COMMERCE_CHECKOUT_NO_LONGER_PENDING"));
assert.ok(clientCheckout.includes("COMMERCE_CHECKOUT_SESSION_RECOVERY_REQUIRED"));
assert.ok(route.includes("COMMERCE_CHECKOUT_SESSION_RECOVERY_REQUIRED"));
assert.match(checkoutSessionRecoveryMigration, /stripeCheckoutSessionCreateStartedAt/);
assert.ok(clientCheckout.includes("sessionStorage.removeItem(checkoutRequestStorageKey(caseId))"));
assert.match(route, /checkoutUrl: result\.checkoutUrl/);
assert.doesNotMatch(route, /customerEmail:\s*input/);
assert.doesNotMatch(route, /STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET/);

assert.match(stripeGateway, /clientCaseId:\s*input\.order\.clientCaseId/);
assert.match(stripeGateway, /publicCheckoutId:\s*input\.order\.publicCheckoutId/);
assert.match(stripeGateway, /payment_intent_data:\s*\{ metadata \}/);
assert.match(stripeGateway, /idempotencyKey:/);

assert.match(webhookRoute, /stripe-signature/);
assert.match(webhookRoute, /readRawBody/);
assert.match(webhookRoute, /reader\.read\(\)/);
assert.match(webhookRoute, /STRIPE_SIGNATURE_INVALID/);
assert.match(webhookRoute, /COMMERCE_WEBHOOK_RETRY/);
assert.match(webhookRoute, /}, 500\)/);

assert.match(paymentRepository, /isolationLevel: "Serializable"/);
assert.match(paymentRepository, /tx\.commercePaymentEvent\.create/);
assert.match(paymentRepository, /tx\.clientCase\.updateMany/);
assert.match(paymentRepository, /assertCheckoutSessionIdentity/);
assert.match(paymentRepository, /attachCheckoutSessionIfNeeded/);
assert.match(migration, /DROP INDEX IF EXISTS "CommerceOrder_clientCaseId_key"/);
assert.match(migration, /CREATE UNIQUE INDEX "CommerceOrder_one_pending_per_case_key"/);
assert.match(migration, /"status" = 'PENDING_PAYMENT'/);
assert.match(migration, /previousPlanId/);

const rateIndex = route.indexOf("enforceCommerceCheckoutRateLimit");
const bodyIndex = route.indexOf("readBoundedJsonBody(request");
assert.ok(rateIndex >= 0 && bodyIndex > rateIndex, "rate limit must precede body parsing/DB work");

assert.match(limiter, /iburo:commerce-checkout:v1/);
assert.match(limiter, /COMMERCE_CHECKOUT_RATE_LIMIT_MAX = 8/);
assert.match(limiter, /createHmac\("sha256", secret\)/);
assert.match(limiter, /readBetterAuthRuntimeConfig/);
assert.doesNotMatch(limiter, /insert[\s\S]{0,300}clientIp/);

console.log("COMMERCE_CHECKOUT_HTTP_CONTRACT_PASS");
