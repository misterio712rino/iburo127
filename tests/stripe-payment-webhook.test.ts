import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import Stripe from "stripe";

import { StripeWebhookGatewayImpl } from "@/server/commerce/stripe-webhook-gateway";
import {
  STRIPE_EVENT_INVALID,
  STRIPE_SIGNATURE_INVALID,
} from "@/server/domain/commerce/stripe-payment-event";
import { StripeWebhookService } from "@/server/domain/commerce/payment-webhook-service";
import type { VerifiedCommercePaymentEvent } from "@/server/domain/commerce/contracts";

const metadata = {
  clientCaseId: "550e8400-e29b-41d4-a716-446655440000",
  publicCheckoutId: "chk_public",
};
const raw = Buffer.from('{"id":"evt_paid","type":"checkout.session.completed"}', "utf8");
let stripeEvent = {
  id: "evt_paid",
  type: "checkout.session.completed",
  created: 1791331200,
  data: {
    object: {
      id: "cs_public",
      payment_intent: "pi_public",
      payment_status: "paid",
      amount_total: 2999000,
      currency: "rub",
      metadata,
    },
  },
} as unknown as Stripe.Event;

// Exercise Stripe's actual HMAC verification locally; this creates no network traffic.
const localSecret = "whsec_local_signature_test";
const localStripe = new Stripe("sk_test_local_signature_test");
const signedPayload = Buffer.from(JSON.stringify(stripeEvent), "utf8");
const signedHeader = localStripe.webhooks.generateTestHeaderString({
  payload: signedPayload.toString("utf8"),
  secret: localSecret,
  timestamp: Math.floor(Date.now() / 1000),
});
let localRepositoryCalls = 0;
const localService = new StripeWebhookService(
  {
    async processVerifiedEvent() {
      localRepositoryCalls += 1;
      return { replay: false };
    },
  },
  new StripeWebhookGatewayImpl(localStripe),
  localSecret,
);
assert.equal((await localService.handle(signedPayload, signedHeader)).ignored, false);
assert.equal(localRepositoryCalls, 1);
await assert.rejects(
  () => localService.handle(signedPayload, signedHeader + "x"),
  new RegExp(STRIPE_SIGNATURE_INVALID),
);
assert.equal(localRepositoryCalls, 1, "bad SDK signature never reaches repository");

let repositoryCalls = 0;
const captured: { event?: VerifiedCommercePaymentEvent } = {};
const repository = {
  async processVerifiedEvent(event: VerifiedCommercePaymentEvent) {
    repositoryCalls += 1;
    captured.event = event;
    return { replay: false };
  },
};
const gateway = {
  constructEvent(body: Buffer, signature: string, secret: string) {
    assert.deepEqual(body, raw);
    assert.equal(secret, "whsec_test");
    if (signature !== "valid") throw new Error("bad signature");
    return stripeEvent;
  },
  async retrievePaymentIntent() {
    return {
      id: "pi_public",
      metadata,
      amount_received: 2999000,
      currency: "rub",
    } as unknown as Stripe.PaymentIntent;
  },
};
const service = new StripeWebhookService(repository, gateway, "whsec_test");

await assert.rejects(
  () => service.handle(raw, "forged"),
  new RegExp(STRIPE_SIGNATURE_INVALID),
);
assert.equal(repositoryCalls, 0);

const success = await service.handle(raw, "valid");
assert.equal(success.ignored, false);
assert.equal(repositoryCalls, 1);
assert.deepEqual(captured.event, {
  provider: "stripe",
  eventId: "evt_paid",
  paymentId: "pi_public",
  publicCheckoutId: "chk_public",
  stripeCheckoutSessionId: "cs_public",
  clientCaseId: metadata.clientCaseId,
  kind: "SUCCEEDED",
  amountMinor: 2999000,
  currency: "RUB",
  occurredAt: new Date(1791331200 * 1000),
  rawBodySha256: createHash("sha256").update(raw).digest("hex"),
});

stripeEvent = {
  ...stripeEvent,
  id: "evt_unpaid",
  data: {
    object: {
      id: "cs_public",
      payment_intent: "pi_public",
      payment_status: "unpaid",
      amount_total: 2999000,
      currency: "rub",
      metadata,
    },
  },
} as unknown as Stripe.Event;
assert.equal((await service.handle(raw, "valid")).ignored, true);
assert.equal(repositoryCalls, 1, "unpaid checkout completion must not activate a plan");

stripeEvent = {
  id: "evt_async_failed",
  type: "checkout.session.async_payment_failed",
  created: 1791331250,
  data: {
    object: {
      id: "cs_failed",
      payment_intent: "pi_failed",
      payment_status: "unpaid",
      amount_total: 2999000,
      currency: "rub",
      metadata,
    },
  },
} as unknown as Stripe.Event;
assert.equal((await service.handle(raw, "valid")).ignored, false);
assert.equal(captured.event?.kind, "FAILED");
assert.equal(repositoryCalls, 2, "delayed payment failure must be stored as failed");

stripeEvent = {
  id: "evt_partial",
  type: "charge.refunded",
  created: 1791331300,
  data: {
    object: {
      id: "ch_partial",
      payment_intent: "pi_public",
      amount: 2999000,
      amount_refunded: 500000,
      currency: "rub",
    },
  },
} as unknown as Stripe.Event;
assert.equal((await service.handle(raw, "valid")).ignored, true);
assert.equal(repositoryCalls, 2, "partial refund must not revoke the plan");

stripeEvent = {
  ...stripeEvent,
  id: "evt_full",
  data: {
    object: {
      id: "ch_full",
      payment_intent: "pi_public",
      amount: 2999000,
      amount_refunded: 2999000,
      currency: "rub",
    },
  },
} as unknown as Stripe.Event;
const refund = await service.handle(raw, "valid");
assert.equal(refund.ignored, false);
assert.equal(repositoryCalls, 3);
assert.equal(captured.event?.kind, "REFUNDED");

stripeEvent = {
  id: "evt_dispute_opened",
  type: "charge.dispute.created",
  created: 1791331340,
  data: {
    object: {
      id: "dp_open",
      payment_intent: "pi_public",
      amount: 2999000,
      currency: "rub",
      status: "needs_response",
    },
  },
} as unknown as Stripe.Event;
assert.equal((await service.handle(raw, "valid")).ignored, true);
assert.equal(repositoryCalls, 3, "an open dispute must not be treated as a final chargeback");

stripeEvent = {
  id: "evt_dispute_won",
  type: "charge.dispute.closed",
  created: 1791331350,
  data: {
    object: {
      id: "dp_won",
      payment_intent: "pi_public",
      amount: 2999000,
      currency: "rub",
      status: "won",
    },
  },
} as unknown as Stripe.Event;
const disputeWon = await service.handle(raw, "valid");
assert.equal(disputeWon.ignored, false);
assert.equal(repositoryCalls, 4);
assert.equal(captured.event?.kind, "SUCCEEDED");
assert.equal(captured.event?.paymentId, "pi_public");

stripeEvent = {
  ...stripeEvent,
  id: "evt_dispute_lost",
  created: 1791331360,
  data: {
    object: {
      id: "dp_lost",
      payment_intent: "pi_public",
      amount: 2999000,
      currency: "rub",
      status: "lost",
    },
  },
} as unknown as Stripe.Event;
const disputeLost = await service.handle(raw, "valid");
assert.equal(disputeLost.ignored, false);
assert.equal(repositoryCalls, 5);
assert.equal(captured.event?.kind, "CHARGEBACK");

stripeEvent = {
  ...stripeEvent,
  id: "evt_dispute_warning_closed",
  data: {
    object: {
      id: "dp_warning",
      payment_intent: "pi_public",
      amount: 2999000,
      currency: "rub",
      status: "warning_closed",
    },
  },
} as unknown as Stripe.Event;
assert.equal((await service.handle(raw, "valid")).ignored, true);
assert.equal(repositoryCalls, 5, "warning-only disputes must not change payment status");

stripeEvent = {
  id: "evt_paid_without_payment_intent",
  type: "checkout.session.completed",
  created: 1791331390,
  data: {
    object: {
      id: "cs_without_payment_intent",
      payment_intent: null,
      payment_status: "paid",
      amount_total: 2999000,
      currency: "rub",
      metadata,
    },
  },
} as unknown as Stripe.Event;
await assert.rejects(() => service.handle(raw, "valid"), new RegExp(STRIPE_EVENT_INVALID));
assert.equal(repositoryCalls, 5, "a paid session without its canonical PaymentIntent must not reach persistence");

stripeEvent = {
  id: "evt_bad_metadata",
  type: "payment_intent.succeeded",
  created: 1791331400,
  data: {
    object: {
      id: "pi_missing_metadata",
      amount: 2999000,
      amount_received: 2999000,
      currency: "rub",
      metadata: {},
    },
  },
} as unknown as Stripe.Event;
await assert.rejects(() => service.handle(raw, "valid"), new RegExp(STRIPE_EVENT_INVALID));
assert.equal(repositoryCalls, 5);

const failingRepository = {
  async processVerifiedEvent() {
    throw new Error("database unavailable");
  },
};
const retryService = new StripeWebhookService(failingRepository, gateway, "whsec_test");
stripeEvent = {
  id: "evt_retry",
  type: "payment_intent.succeeded",
  created: 1791331500,
  data: {
    object: {
      id: "pi_retry",
      amount: 2999000,
      amount_received: 2999000,
      currency: "rub",
      metadata,
    },
  },
} as unknown as Stripe.Event;
await assert.rejects(() => retryService.handle(raw, "valid"), /database unavailable/);

console.log("STRIPE_PAYMENT_WEBHOOK_PASS");
