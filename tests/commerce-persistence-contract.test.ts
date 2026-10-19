import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const schema = await readFile(resolve("prisma/schema.prisma"), "utf8");
const packageJson = JSON.parse(await readFile(resolve("package.json"), "utf8")) as {
  scripts?: Record<string, string>;
};
const paymentEventRepository = await readFile(
  resolve("server/repositories/prisma/commerce-payment-event-repository.ts"),
  "utf8",
);
const migration = await readFile(resolve("prisma/migrations/20260927_commerce_foundation/migration.sql"), "utf8");
const checkoutIdempotencyMigration = await readFile(
  resolve("prisma/migrations/20260927_commerce_order_checkout_idempotency/migration.sql"),
  "utf8",
);
const stripeCheckoutMigration = await readFile(
  resolve("prisma/migrations/20261007_commerce_stripe_checkout/migration.sql"),
  "utf8",
);
const checkoutSessionRecoveryMigration = await readFile(
  resolve("prisma/migrations/20261008_commerce_checkout_session_recovery/migration.sql"),
  "utf8",
);
const checkoutSessionRecoveryAuditMigration = await readFile(
  resolve("prisma/migrations/20261008_commerce_checkout_session_recovery_audit/migration.sql"),
  "utf8",
);
const checkoutRecoveryRepository = await readFile(
  resolve("server/repositories/prisma/commerce-checkout-recovery-repository.ts"),
  "utf8",
);

for (const enumName of [
  "CommerceOrderStatus",
  "CommercePaymentStatus",
  "CommercePaymentEventKind",
  "CommercePaymentEventProcessingStatus",
]) {
  assert.match(schema, new RegExp("enum " + enumName + " \\{"));
}

for (const modelName of ["CommerceOrder", "CommercePayment", "CommercePaymentEvent"]) {
  assert.match(schema, new RegExp("model " + modelName + " \\{"));
  assert.match(migration, new RegExp('CREATE TABLE "' + modelName + '"'));
}

assert.match(schema, /publicCheckoutId\s+String\s+@unique/);
assert.match(schema, /checkoutRequestId\s+String\?\s+@unique @db\.Uuid/);
assert.match(schema, /clientCaseId\s+String\?\s+@db\.Uuid/);
assert.doesNotMatch(schema, /clientCaseId\s+String\?\s+@unique @db\.Uuid/);
assert.match(schema, /stripeCheckoutSessionId\s+String\?\s+@unique/);
assert.match(schema, /previousPlanId\s+String\?\s+@db\.Uuid/);
assert.match(schema, /@@unique\(\[provider, providerPaymentId\]\)/);
assert.match(schema, /@@unique\(\[provider, providerEventId\]\)/);
assert.match(
  paymentEventRepository,
  /assertCommercePaymentOrderIdentity\(\{\s*orderId: order\.id,\s*paymentOrderId: existingPayment\.orderId/,
  "a Stripe payment ID already linked to another order must be rejected",
);
assert.match(schema, /rawBodySha256\s+String/);
assert.match(schema, /verifiedAt\s+DateTime/);
assert.match(schema, /processingStatus\s+CommercePaymentEventProcessingStatus/);
assert.match(schema, /plan\s+Plan\s+@relation\(fields: \[planId\]/);
assert.match(schema, /user\s+User\?\s+@relation\("CommerceOrderUser"/);
assert.match(schema, /clientCase\s+ClientCase\?\s+@relation\(fields: \[clientCaseId\]/);
assert.match(schema, /commerceOrders\s+CommerceOrder\[\]\s+@relation\("CommerceOrderUser"\)/);
assert.match(schema, /commerceOrders\s+CommerceOrder\[\]/);

const userModelStart = schema.indexOf("model User {");
const userModelEnd = schema.indexOf("\n}", userModelStart);
assert.ok(userModelStart >= 0 && userModelEnd > userModelStart, "User model must exist");
const userModel = schema.slice(userModelStart, userModelEnd + 2);
assert.doesNotMatch(userModel, /\bplanId\s+String/, "commerce must not put a planId on User");
assert.doesNotMatch(schema, /rawPayload|rawBody\s+String|webhookBody/);

assert.match(migration, /CommerceOrder_amountMinor_check/);
assert.match(migration, /CommercePayment_amountMinor_check/);
assert.match(migration, /CommercePaymentEvent_amountMinor_check/);
assert.match(migration, /currency" ~ '\^\[A-Z\]\{3\}\$'/);
assert.match(migration, /rawBodySha256" ~ '\^\[0-9a-f\]\{64\}\$'/);
assert.match(migration, /CommerceOrder_publicCheckoutId_key/);
assert.match(migration, /CommerceOrder_clientCaseId_key/);
assert.match(stripeCheckoutMigration, /DROP INDEX IF EXISTS "CommerceOrder_clientCaseId_key"/);
assert.match(stripeCheckoutMigration, /CREATE UNIQUE INDEX "CommerceOrder_one_pending_per_case_key"/);
assert.match(stripeCheckoutMigration, /WHERE "clientCaseId" IS NOT NULL/);
assert.ok(schema.includes("stripeCheckoutSessionCreateStartedAt DateTime?"));
assert.ok(checkoutSessionRecoveryMigration.includes('ADD COLUMN "stripeCheckoutSessionCreateStartedAt" TIMESTAMP(3)'));
assert.match(schema, /model CommerceCheckoutSessionRecovery \{/);
assert.match(schema, /checkoutSessionRecovery\s+CommerceCheckoutSessionRecovery\?/);
assert.match(checkoutSessionRecoveryAuditMigration, /CREATE TABLE "CommerceCheckoutSessionRecovery"/);
assert.match(checkoutSessionRecoveryAuditMigration, /CommerceCheckoutSessionRecovery_orderId_key/);
assert.match(checkoutSessionRecoveryAuditMigration, /CommerceCheckoutSessionRecovery_stripeCheckoutSessionId_key/);
assert.match(checkoutRecoveryRepository, /\$transaction[\s\S]*isolationLevel: "Serializable"/);
assert.match(checkoutRecoveryRepository, /tx\.commerceCheckoutSessionRecovery\.create/);
assert.equal(
  packageJson.scripts?.["test:commerce:postgres-checkout-recovery"],
  "node --conditions=react-server --import tsx tests/commerce-postgres-checkout-recovery.integration.ts",
  "PostgreSQL checkout recovery test must be explicit and opt-in",
);
assert.match(
  stripeCheckoutMigration,
  /SET "previousPlanId" = cases\."planId"[\s\S]*WHERE orders\."clientCaseId" = cases\."id"[\s\S]*AND orders\."status" = 'PENDING_PAYMENT'/,
  "only pending historical orders can infer their pre-payment plan from the current case state",
);
assert.match(migration, /CommercePayment_provider_providerPaymentId_key/);
assert.match(migration, /CommercePaymentEvent_provider_providerEventId_key/);

for (const relation of [
  "CommerceOrder_planId_fkey",
  "CommerceOrder_userId_fkey",
  "CommerceOrder_clientCaseId_fkey",
  "CommercePayment_orderId_fkey",
  "CommercePaymentEvent_orderId_fkey",
  "CommercePaymentEvent_paymentId_fkey",
]) {
  assert.match(migration, new RegExp(relation));
}

assert.doesNotMatch(migration, /rawPayload|webhookBody/);
assert.match(checkoutIdempotencyMigration, /ADD COLUMN "checkoutRequestId" UUID/);
assert.match(checkoutIdempotencyMigration, /CommerceOrder_checkoutRequestId_key/);
assert.match(checkoutIdempotencyMigration, /CREATE UNIQUE INDEX/);

console.log("COMMERCE_PERSISTENCE_CONTRACT_PASS");
