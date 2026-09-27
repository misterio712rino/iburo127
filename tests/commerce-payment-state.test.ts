import assert from "node:assert/strict";

import {
  COMMERCE_INVALID_INPUT,
  COMMERCE_PAYMENT_AMOUNT_MISMATCH,
  COMMERCE_PAYMENT_CURRENCY_MISMATCH,
  COMMERCE_PAYMENT_IDENTITY_CONFLICT,
  COMMERCE_PLAN_UNAVAILABLE,
  COMMERCE_UNSUPPORTED_PLAN,
  type CommerceOrderSnapshot,
  type CommercePaymentSnapshot,
  type VerifiedCommercePaymentEvent,
} from "@/server/domain/commerce/contracts";
import {
  applyVerifiedCommercePaymentEvent,
  normalizeVerifiedCommercePaymentEvent,
  resolveCommerceCheckoutQuote,
} from "@/server/domain/commerce/payment-state";

const checkoutId = "checkout_test_123456789";
const provider = "provider-test";
const paymentId = "payment-1";
const hash = "a".repeat(64);
const t1 = new Date("2026-09-27T01:00:00.000Z");
const t2 = new Date("2026-09-27T01:01:00.000Z");
const t3 = new Date("2026-09-27T01:02:00.000Z");

const catalog = {
  LITE: {
    planCode: "LITE" as const,
    amountMinor: 123_400,
    currency: "rub",
    offerVersion: "offer-test-v1",
    active: true,
  },
  PRO: {
    planCode: "PRO" as const,
    amountMinor: 567_800,
    currency: "RUB",
    offerVersion: "offer-test-v1",
    active: true,
  },
};

const quote = resolveCommerceCheckoutQuote("LITE", catalog);
assert.deepEqual(quote, {
  planCode: "LITE",
  amountMinor: 123_400,
  currency: "RUB",
  offerVersion: "offer-test-v1",
});
assert.throws(
  () => resolveCommerceCheckoutQuote("INDIVIDUAL", catalog),
  new RegExp(COMMERCE_UNSUPPORTED_PLAN),
);
assert.throws(
  () => resolveCommerceCheckoutQuote("PRO", { ...catalog, PRO: { ...catalog.PRO, active: false } }),
  new RegExp(COMMERCE_PLAN_UNAVAILABLE),
);
assert.throws(
  () => resolveCommerceCheckoutQuote("LITE", { ...catalog, LITE: { ...catalog.LITE, amountMinor: 0 } }),
  new RegExp(COMMERCE_INVALID_INPUT),
);

function order(
  status: CommerceOrderSnapshot["status"] = "PENDING_PAYMENT",
): CommerceOrderSnapshot {
  return {
    publicCheckoutId: checkoutId,
    planCode: "LITE",
    amountMinor: 123_400,
    currency: "RUB",
    status,
  };
}

function event(
  kind: VerifiedCommercePaymentEvent["kind"],
  occurredAt = t1,
  overrides: Partial<VerifiedCommercePaymentEvent> = {},
): VerifiedCommercePaymentEvent {
  return {
    provider,
    eventId: `event-${kind}-${occurredAt.getTime()}`,
    paymentId,
    publicCheckoutId: checkoutId,
    kind,
    amountMinor: 123_400,
    currency: "RUB",
    occurredAt,
    rawBodySha256: hash,
    ...overrides,
  };
}

function payment(
  status: CommercePaymentSnapshot["status"],
  occurredAt: Date,
): CommercePaymentSnapshot {
  return {
    provider,
    paymentId,
    amountMinor: 123_400,
    currency: "RUB",
    status,
    providerOccurredAt: occurredAt,
  };
}

{
  const normalized = normalizeVerifiedCommercePaymentEvent(
    event("SUCCEEDED", t1, { currency: "rub", rawBodySha256: "A".repeat(64) }),
  );
  assert.equal(normalized.currency, "RUB");
  assert.equal(normalized.rawBodySha256, hash);
}

{
  const transition = applyVerifiedCommercePaymentEvent({
    order: order(),
    payment: null,
    event: event("SUCCEEDED"),
  });
  assert.equal(transition.paymentStatus, "SUCCEEDED");
  assert.equal(transition.orderStatus, "PAID");
  assert.equal(transition.orderBecamePaid, true);
  assert.equal(transition.shouldPauseProvisionedCase, false);
  assert.equal(transition.applied, true);
}

{
  const failed = applyVerifiedCommercePaymentEvent({
    order: order(),
    payment: null,
    event: event("FAILED"),
  });
  assert.equal(failed.paymentStatus, "FAILED");
  assert.equal(failed.orderStatus, "PAYMENT_FAILED");
  assert.equal(failed.orderBecamePaid, false);

  const recovered = applyVerifiedCommercePaymentEvent({
    order: order("PAYMENT_FAILED"),
    payment: payment("FAILED", t1),
    event: event("SUCCEEDED", t2),
  });
  assert.equal(recovered.paymentStatus, "SUCCEEDED");
  assert.equal(recovered.orderStatus, "PAID");
  assert.equal(recovered.orderBecamePaid, true);
}

{
  const cancelled = applyVerifiedCommercePaymentEvent({
    order: order(),
    payment: null,
    event: event("CANCELLED"),
  });
  assert.equal(cancelled.paymentStatus, "CANCELLED");
  assert.equal(cancelled.orderStatus, "CANCELLED");
}

{
  const replay = applyVerifiedCommercePaymentEvent({
    order: order("PAID"),
    payment: payment("SUCCEEDED", t2),
    event: event("SUCCEEDED", t2),
  });
  assert.equal(replay.applied, false);
  assert.equal(replay.stale, true);
  assert.equal(replay.paymentStatus, "SUCCEEDED");
  assert.equal(replay.orderStatus, "PAID");
}

{
  const oldFailure = applyVerifiedCommercePaymentEvent({
    order: order("PAID"),
    payment: payment("SUCCEEDED", t2),
    event: event("FAILED", t1),
  });
  assert.equal(oldFailure.applied, false);
  assert.equal(oldFailure.stale, true);
  assert.equal(oldFailure.paymentStatus, "SUCCEEDED");
  assert.equal(oldFailure.orderStatus, "PAID");
}

{
  const newerFailure = applyVerifiedCommercePaymentEvent({
    order: order("PROVISIONED"),
    payment: payment("SUCCEEDED", t1),
    event: event("FAILED", t2),
  });
  assert.equal(newerFailure.paymentStatus, "SUCCEEDED");
  assert.equal(newerFailure.orderStatus, "PROVISIONED");
  assert.equal(newerFailure.orderBecamePaid, false);
}

{
  const refund = applyVerifiedCommercePaymentEvent({
    order: order("PROVISIONED"),
    payment: payment("SUCCEEDED", t1),
    event: event("REFUNDED", t2),
  });
  assert.equal(refund.paymentStatus, "REFUNDED");
  assert.equal(refund.orderStatus, "REFUNDED");
  assert.equal(refund.shouldPauseProvisionedCase, true);

  const lateSuccess = applyVerifiedCommercePaymentEvent({
    order: order("REFUNDED"),
    payment: payment("REFUNDED", t2),
    event: event("SUCCEEDED", t3),
  });
  assert.equal(lateSuccess.paymentStatus, "REFUNDED");
  assert.equal(lateSuccess.orderStatus, "REFUNDED");
  assert.equal(lateSuccess.orderBecamePaid, false);
}

{
  const chargeback = applyVerifiedCommercePaymentEvent({
    order: order("REFUNDED"),
    payment: payment("REFUNDED", t2),
    event: event("CHARGEBACK", t3),
  });
  assert.equal(chargeback.paymentStatus, "CHARGEBACK");
  assert.equal(chargeback.orderStatus, "CHARGEBACK");
  assert.equal(chargeback.shouldPauseProvisionedCase, false);
}

for (const [overrides, code] of [
  [{ amountMinor: 123_401 }, COMMERCE_PAYMENT_AMOUNT_MISMATCH],
  [{ currency: "USD" }, COMMERCE_PAYMENT_CURRENCY_MISMATCH],
  [{ publicCheckoutId: "other-checkout" }, COMMERCE_PAYMENT_IDENTITY_CONFLICT],
] as const) {
  assert.throws(
    () =>
      applyVerifiedCommercePaymentEvent({
        order: order(),
        payment: null,
        event: event("SUCCEEDED", t1, overrides),
      }),
    new RegExp(code),
  );
}

for (const existing of [
  { ...payment("PENDING", t1), provider: "other-provider" },
  { ...payment("PENDING", t1), paymentId: "other-payment" },
]) {
  assert.throws(
    () =>
      applyVerifiedCommercePaymentEvent({
        order: order(),
        payment: existing,
        event: event("SUCCEEDED", t2),
      }),
    new RegExp(COMMERCE_PAYMENT_IDENTITY_CONFLICT),
  );
}

assert.throws(
  () => normalizeVerifiedCommercePaymentEvent(event("SUCCEEDED", t1, { rawBodySha256: "bad" })),
  new RegExp(COMMERCE_INVALID_INPUT),
);

console.log("COMMERCE_PAYMENT_STATE_TEST_PASS");
