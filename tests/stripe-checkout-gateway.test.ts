import assert from "node:assert/strict";
import type Stripe from "stripe";

import { StripeCheckoutGateway } from "@/server/commerce/stripe-checkout-gateway";

const calls: Array<{
  params: Stripe.Checkout.SessionCreateParams;
  options?: Stripe.RequestOptions;
}> = [];
const fakeStripe = {
  checkout: {
    sessions: {
      create: async (params: Stripe.Checkout.SessionCreateParams, options?: Stripe.RequestOptions) => {
        calls.push({ params, options });
        return {
          id: "cs_test_local",
          url: "https://checkout.stripe.com/c/pay/cs_test_local",
          status: "open",
        } as Stripe.Checkout.Session;
      },
      retrieve: async () => ({
        id: "cs_test_local",
        url: "https://checkout.stripe.com/c/pay/cs_test_local",
        status: "open",
      }) as Stripe.Checkout.Session,
    },
  },
} as unknown as Stripe;

const gateway = new StripeCheckoutGateway(fakeStripe);
const result = await gateway.createSession({
  order: {
    publicCheckoutId: "chk_local_opaque",
    clientCaseId: "87c655b2-5ac5-4b57-8aa7-c99cddbf06aa",
    planCode: "PRO",
    amountMinor: 12345,
    currency: "RUB",
    offerVersion: "unit-test-offer",
    status: "PENDING_PAYMENT",
    replayed: false,
    stripeCheckoutSessionId: null,
    customerEmail: "client@example.test",
  },
  customerEmail: "client@example.test",
  origin: "https://app.example.test",
});

assert.equal(result.status, "open");
assert.equal(result.url, "https://checkout.stripe.com/c/pay/cs_test_local");
assert.equal(calls.length, 1);
const call = calls[0];
assert.ok(call);
assert.equal(call.options?.idempotencyKey, "iburo-commerce-checkout:chk_local_opaque");
assert.equal(call.params.mode, "payment");
assert.equal(call.params.line_items?.[0]?.price_data?.unit_amount, 12345);
assert.deepEqual(call.params.metadata, {
  clientCaseId: "87c655b2-5ac5-4b57-8aa7-c99cddbf06aa",
  publicCheckoutId: "chk_local_opaque",
});
assert.deepEqual(call.params.payment_intent_data?.metadata, call.params.metadata);
assert.equal(call.params.success_url, "https://app.example.test/portal/cases/87c655b2-5ac5-4b57-8aa7-c99cddbf06aa?checkout=success");
assert.equal(call.params.cancel_url, "https://app.example.test/portal/cases/87c655b2-5ac5-4b57-8aa7-c99cddbf06aa?checkout=cancelled");

console.log("PASS stripe checkout gateway metadata, idempotency, amount, and portal return paths");
