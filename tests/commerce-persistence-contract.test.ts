import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const schema = await readFile(resolve("prisma/schema.prisma"), "utf8");
const migration = await readFile(
  resolve("prisma/migrations/20260927_commerce_foundation/migration.sql"),
  "utf8",
);

for (const enumName of [
  "CommerceOrderStatus",
  "CommercePaymentStatus",
  "CommercePaymentEventKind",
  "CommercePaymentEventProcessingStatus",
]) {
  assert.match(schema, new RegExp(`enum ${enumName} \\\{`));
}

for (const modelName of ["CommerceOrder", "CommercePayment", "CommercePaymentEvent"]) {
  assert.match(schema, new RegExp(`model ${modelName} \\\{`));
  assert.match(migration, new RegExp(`CREATE TABLE "${modelName}"`));
}

assert.match(schema, /publicCheckoutId String\s+@unique/);
assert.match(schema, /clientCaseId\s+String\?\s+@unique @db\.Uuid/);
assert.match(schema, /@@unique\(\[provider, providerPaymentId\]\)/);
assert.match(schema, /@@unique\(\[provider, providerEventId\]\)/);
assert.match(schema, /rawBodySha256\s+String/);
assert.match(schema, /verifiedAt\s+DateTime/);
assert.match(schema, /processingStatus\s+CommercePaymentEventProcessingStatus/);
assert.match(schema, /plan\s+Plan\s+@relation\(fields: \[planId\]/);
assert.match(schema, /user\s+User\?\s+@relation\("CommerceOrderUser"/);
assert.match(schema, /clientCase\s+ClientCase\?\s+@relation\(fields: \[clientCaseId\]/);
assert.match(schema, /commerceOrders\s+CommerceOrder\[\]\s+@relation\("CommerceOrderUser"\)/);
assert.match(schema, /commerceOrder\s+CommerceOrder\?/);

assert.doesNotMatch(
  schema,
  /model User \{[\s\S]*?\n\}[\s\S]*?planId\s+String/,
  "commerce must not put a planId on User",
);
assert.doesNotMatch(schema, /rawPayload|rawBody\s+String|webhookBody/);

assert.match(migration, /CommerceOrder_amountMinor_check/);
assert.match(migration, /CommercePayment_amountMinor_check/);
assert.match(migration, /CommercePaymentEvent_amountMinor_check/);
assert.match(migration, /currency" ~ '\^\[A-Z\]\{3\}\$'/);
assert.match(migration, /rawBodySha256" ~ '\^\[0-9a-f\]\{64\}\$'/);
assert.match(migration, /CommerceOrder_publicCheckoutId_key/);
assert.match(migration, /CommerceOrder_clientCaseId_key/);
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

console.log("COMMERCE_PERSISTENCE_CONTRACT_PASS");
