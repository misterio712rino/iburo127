import assert from "node:assert/strict";

import {
  CommerceCheckoutRecoveryService,
  COMMERCE_CHECKOUT_RECOVERY_FORBIDDEN,
  COMMERCE_CHECKOUT_RECOVERY_INVALID_INPUT,
  COMMERCE_CHECKOUT_RECOVERY_NOT_ELIGIBLE,
  COMMERCE_CHECKOUT_RECOVERY_SESSION_MISMATCH,
  type CheckoutRecoveryCandidate,
  type RecoveredStripeCheckoutSession,
} from "@/server/domain/commerce/checkout-recovery-service";
import { STRIPE_CHECKOUT_IDEMPOTENCY_SAFE_WINDOW_MS } from "@/server/domain/commerce/checkout-service";

const now = new Date("2026-10-08T10:00:00.000Z");
const candidate: CheckoutRecoveryCandidate = {
  id: "order-id",
  publicCheckoutId: "chk_abcdefghijklmnopqrstuvwx12345678",
  clientCaseId: "550e8400-e29b-41d4-a716-446655440000",
  amountMinor: 2999000,
  currency: "RUB",
  status: "PENDING_PAYMENT",
  stripeCheckoutSessionId: null,
  createStartedAt: new Date(now.getTime() - STRIPE_CHECKOUT_IDEMPOTENCY_SAFE_WINDOW_MS - 1000),
  paymentCount: 0,
  eventCount: 0,
  recoveredSessionId: null,
};
const session: RecoveredStripeCheckoutSession = {
  id: "cs_test_123456789",
  url: "https://checkout.stripe.com/c/pay/cs_test_123456789",
  status: "open",
  mode: "payment",
  clientReferenceId: candidate.publicCheckoutId,
  metadata: {
    publicCheckoutId: candidate.publicCheckoutId,
    clientCaseId: candidate.clientCaseId!,
  },
  amountTotal: candidate.amountMinor,
  currency: "rub",
};
const input = {
  publicCheckoutId: candidate.publicCheckoutId,
  stripeCheckoutSessionId: session.id,
  evidenceReference: "INC-2026-000123",
};
const manager = { userId: "operator-id", roles: ["MANAGER"] as const };
const lawyer = { userId: "lawyer-id", roles: ["LAWYER"] as const };

function setup(initial: CheckoutRecoveryCandidate = { ...candidate }, stripeSession = session) {
  let current = { ...initial };
  const saved: Array<Record<string, unknown>> = [];
  let stripeReads = 0;
  const service = new CommerceCheckoutRecoveryService(
    {
      async getCandidate(id) {
        assert.equal(id, candidate.publicCheckoutId);
        return { ...current };
      },
      async attachExistingSession(value) {
        saved.push(value);
        current = { ...current, stripeCheckoutSessionId: value.stripeCheckoutSessionId,
          recoveredSessionId: value.stripeCheckoutSessionId };
      },
    },
    {
      async retrieveSession(id) {
        stripeReads += 1;
        assert.equal(id, session.id);
        return { ...stripeSession };
      },
    },
    () => now,
  );
  return { service, saved, get stripeReads() { return stripeReads; } };
}

const success = setup();
assert.deepEqual(await success.service.attachExistingOpenSession(manager, input), {
  stripeCheckoutSessionId: session.id,
  replayed: false,
});
assert.equal(success.saved.length, 1);
assert.equal(success.saved[0].operatorUserId, manager.userId);
assert.equal(success.saved[0].evidenceReference, input.evidenceReference);
assert.equal(success.saved[0].expectedCreateStartedAt, candidate.createStartedAt);

const replay = setup({ ...candidate, stripeCheckoutSessionId: session.id, recoveredSessionId: session.id });
assert.deepEqual(await replay.service.attachExistingOpenSession(manager, input), {
  stripeCheckoutSessionId: session.id,
  replayed: true,
});
assert.equal(replay.stripeReads, 0, "a recorded recovery replay must not call Stripe again");

const forbidden = setup();
await assert.rejects(
  () => forbidden.service.attachExistingOpenSession(lawyer, input),
  new RegExp(COMMERCE_CHECKOUT_RECOVERY_FORBIDDEN),
);
assert.equal(forbidden.stripeReads, 0);

const activeAttempt = setup({
  ...candidate,
  createStartedAt: new Date(now.getTime() - STRIPE_CHECKOUT_IDEMPOTENCY_SAFE_WINDOW_MS + 1000),
});
await assert.rejects(
  () => activeAttempt.service.attachExistingOpenSession(manager, input),
  new RegExp(COMMERCE_CHECKOUT_RECOVERY_NOT_ELIGIBLE),
);
assert.equal(activeAttempt.stripeReads, 0);

for (const blocked of [
  { ...candidate, paymentCount: 1 },
  { ...candidate, eventCount: 1 },
  { ...candidate, status: "PAID" },
]) {
  const scenario = setup(blocked);
  await assert.rejects(
    () => scenario.service.attachExistingOpenSession(manager, input),
    new RegExp(COMMERCE_CHECKOUT_RECOVERY_NOT_ELIGIBLE),
  );
  assert.equal(scenario.stripeReads, 0);
}

for (const mismatch of [
  { ...session, id: "cs_test_other" },
  { ...session, status: "complete" as const },
  { ...session, mode: "subscription" },
  { ...session, clientReferenceId: "chk_other" },
  { ...session, metadata: { ...session.metadata, clientCaseId: "other-case" } },
  { ...session, amountTotal: 1 },
  { ...session, currency: "usd" },
  { ...session, url: "https://example.test/pay" },
]) {
  const scenario = setup(candidate, mismatch);
  await assert.rejects(
    () => scenario.service.attachExistingOpenSession(manager, input),
    new RegExp(COMMERCE_CHECKOUT_RECOVERY_SESSION_MISMATCH),
  );
  assert.equal(scenario.saved.length, 0);
}

const malformed = setup();
await assert.rejects(
  () => malformed.service.attachExistingOpenSession(manager, { ...input, force: true }),
  new RegExp(COMMERCE_CHECKOUT_RECOVERY_INVALID_INPUT),
);
assert.equal(malformed.stripeReads, 0);

const failedWrite = new CommerceCheckoutRecoveryService(
  {
    async getCandidate() { return { ...candidate }; },
    async attachExistingSession() { throw new Error("COMMERCE_CHECKOUT_RECOVERY_CONFLICT"); },
  },
  { async retrieveSession() { return { ...session }; } },
  () => now,
);
await assert.rejects(
  () => failedWrite.attachExistingOpenSession(manager, input),
  /COMMERCE_CHECKOUT_RECOVERY_CONFLICT/,
);

console.log("COMMERCE_CHECKOUT_RECOVERY_SERVICE_PASS");
