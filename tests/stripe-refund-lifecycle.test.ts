import assert from "node:assert/strict";

import { eventFromStripe } from "@/server/domain/commerce/stripe-payment-event";

const rawBody = Buffer.from("local stripe refund fixture");
const metadata = {
  clientCaseId: "550e8400-e29b-41d4-a716-446655440000",
  publicCheckoutId: "chk_refund_lifecycle",
};
const chargeAmount = 2_999_000;
let intentLookups = 0;

function refundEvent(input: {
  id: string;
  created: number;
  amountRefunded: number;
}) {
  return {
    id: input.id,
    type: "charge.refunded",
    created: input.created,
    data: {
      object: {
        id: `ch_${input.id}`,
        payment_intent: "pi_refund_lifecycle",
        amount: chargeAmount,
        amount_refunded: input.amountRefunded,
        currency: "rub",
      },
    },
  } as never;
}

async function parseRefund(input: Parameters<typeof refundEvent>[0]) {
  return eventFromStripe(
    refundEvent(input),
    rawBody,
    async (id) => {
      intentLookups += 1;
      assert.equal(id, "pi_refund_lifecycle");
      return {
        id,
        metadata,
        amount_received: chargeAmount,
        currency: "rub",
      } as never;
    },
  );
}

assert.equal(
  await parseRefund({ id: "evt_partial_1", created: 100, amountRefunded: 400_000 }),
  null,
  "first partial refund stays unapplied",
);
assert.equal(
  await parseRefund({ id: "evt_partial_2", created: 200, amountRefunded: 2_000_000 }),
  null,
  "additional partial refund stays unapplied while cumulative amount is below total",
);
assert.equal(intentLookups, 0, "partial refunds do not require a PaymentIntent lookup");

const fullRefund = await parseRefund({
  id: "evt_refund_full",
  created: 300,
  amountRefunded: chargeAmount,
});
assert.equal(fullRefund?.kind, "REFUNDED");
assert.equal(fullRefund?.amountMinor, chargeAmount);
assert.equal(fullRefund?.paymentId, "pi_refund_lifecycle");
assert.equal(intentLookups, 1);

const partialDispute = await eventFromStripe(
  {
    id: "evt_partial_dispute_lost",
    type: "charge.dispute.closed",
    created: 350,
    data: {
      object: {
        id: "dp_partial",
        payment_intent: "pi_refund_lifecycle",
        amount: 1_000_000,
        currency: "rub",
        status: "lost",
      },
    },
  } as never,
  rawBody,
  async (id) => {
    intentLookups += 1;
    assert.equal(id, "pi_refund_lifecycle");
    return {
      id,
      metadata,
      amount_received: chargeAmount,
      currency: "rub",
    } as never;
  },
);
assert.equal(partialDispute?.kind, "CHARGEBACK");
assert.equal(partialDispute?.amountMinor, chargeAmount, "order matching uses the paid PaymentIntent amount");
assert.equal(partialDispute?.currency, "RUB");
assert.equal(intentLookups, 2);

assert.equal(
  await parseRefund({ id: "evt_partial_delivered_late", created: 150, amountRefunded: 400_000 }),
  null,
  "a delayed partial-refund event cannot produce a second refund effect",
);

console.log("STRIPE_REFUND_LIFECYCLE_PASS");
