import assert from "node:assert/strict";

import {
  CommerceCheckoutService,
  STRIPE_CHECKOUT_IDEMPOTENCY_SAFE_WINDOW_MS,
} from "@/server/domain/commerce/checkout-service";
import type { CommerceCaseCheckoutOrder } from "@/server/domain/commerce/contracts";

const order: CommerceCaseCheckoutOrder = {
  publicCheckoutId: "chk_public",
  clientCaseId: "550e8400-e29b-41d4-a716-446655440000",
  planCode: "PRO",
  amountMinor: 2999000,
  currency: "RUB",
  offerVersion: "offer-2026-10-07",
  status: "PENDING_PAYMENT",
  replayed: false,
  stripeCheckoutSessionId: null,
  customerEmail: "client@example.test",
};

let savedOrder = { ...order };
let createStartedAt: Date | null = null;
let attachAttempts = 0;
const repository = {
  async createPendingOrder(input: { planCode: unknown }) {
    if (input.planCode !== savedOrder.planCode) {
      throw new Error("COMMERCE_CHECKOUT_IDEMPOTENCY_CONFLICT");
    }
    return { ...savedOrder };
  },
  async prepareStripeCheckoutSession() {
    createStartedAt ??= new Date();
    return {
      stripeCheckoutSessionId: savedOrder.stripeCheckoutSessionId,
      createStartedAt,
    };
  },
  async attachStripeCheckoutSession(input: { stripeCheckoutSessionId: string }) {
    attachAttempts += 1;
    if (attachAttempts === 1) throw new Error("simulated database write failure");
    savedOrder = { ...savedOrder, stripeCheckoutSessionId: input.stripeCheckoutSessionId };
  },
};

const sessions = new Map<string, { id: string; url: string; status: "open" }>();
let createCalls = 0;
const stripe = {
  async createSession(input: { order: CommerceCaseCheckoutOrder }) {
    createCalls += 1;
    const key = input.order.publicCheckoutId;
    let session = sessions.get(key);
    if (!session) {
      session = { id: "cs_stable", url: "https://checkout.stripe.com/c/pay/cs_stable", status: "open" };
      sessions.set(key, session);
    }
    return session;
  },
  async retrieveSession(id: string) {
    const found = [...sessions.values()].find((item) => item.id === id);
    assert.ok(found);
    return found;
  },
};

const service = new CommerceCheckoutService(repository, stripe);
const input = {
  userId: "550e8400-e29b-41d4-a716-446655440001",
  clientCaseId: order.clientCaseId,
  requestId: "550e8400-e29b-41d4-a716-446655440002",
  planCode: "PRO",
  catalog: {
    PRO: {
      planCode: "PRO" as const,
      amountMinor: 2999000,
      currency: "RUB",
      offerVersion: "offer-2026-10-07",
      active: true,
    },
  },
  origin: "https://www.iburo127.ru",
};

await assert.rejects(() => service.startCheckout(input), /simulated database write failure/);
assert.equal(createCalls, 1);
assert.equal(savedOrder.stripeCheckoutSessionId, null);

const recovered = await service.startCheckout(input);
assert.equal(recovered.checkoutUrl, "https://checkout.stripe.com/c/pay/cs_stable");
assert.equal(savedOrder.stripeCheckoutSessionId, "cs_stable");
assert.equal(createCalls, 2, "retry calls Stripe with the same stable idempotency identity");
assert.equal(attachAttempts, 2);

const replay = await service.startCheckout(input);
assert.equal(replay.checkoutUrl, recovered.checkoutUrl);
assert.equal(createCalls, 2, "attached checkout session is retrieved on later replay");

await assert.rejects(
  () => service.startCheckout({ ...input, planCode: "LITE" }),
  /COMMERCE_CHECKOUT_IDEMPOTENCY_CONFLICT/,
);

let staleCreateCalls = 0;
const staleService = new CommerceCheckoutService(
  {
    async createPendingOrder() {
      return { ...order };
    },
    async prepareStripeCheckoutSession() {
      return {
        stripeCheckoutSessionId: null,
        createStartedAt: new Date(Date.now() - STRIPE_CHECKOUT_IDEMPOTENCY_SAFE_WINDOW_MS - 1),
      };
    },
    async attachStripeCheckoutSession() {},
  },
  {
    async createSession() {
      staleCreateCalls += 1;
      return { id: "cs_duplicate", url: "https://checkout.stripe.com/c/pay/cs_duplicate", status: "open" };
    },
    async retrieveSession() {
      throw new Error("unexpected session retrieval");
    },
  },
);
await assert.rejects(
  () => staleService.startCheckout(input),
  /COMMERCE_CHECKOUT_SESSION_RECOVERY_REQUIRED/,
);
assert.equal(staleCreateCalls, 0, "expired idempotency window must fail closed before Stripe create");

let recoveredAttachId: string | null = null;
const foundSessionService = new CommerceCheckoutService(
  {
    async createPendingOrder() {
      return { ...order };
    },
    async prepareStripeCheckoutSession() {
      return { stripeCheckoutSessionId: "cs_recovered", createStartedAt: new Date() };
    },
    async attachStripeCheckoutSession(input) {
      recoveredAttachId = input.stripeCheckoutSessionId;
    },
  },
  {
    async createSession() {
      throw new Error("must retrieve the already attached session");
    },
    async retrieveSession(id) {
      assert.equal(id, "cs_recovered");
      return { id, url: "https://checkout.stripe.com/c/pay/cs_recovered", status: "open" };
    },
  },
);
const foundSession = await foundSessionService.startCheckout(input);
assert.equal(foundSession.checkoutUrl, "https://checkout.stripe.com/c/pay/cs_recovered");
assert.equal(recoveredAttachId, "cs_recovered");

const terminalService = new CommerceCheckoutService(
  {
    async createPendingOrder() {
      return { ...order, status: "CANCELLED" as const, replayed: true };
    },
    async prepareStripeCheckoutSession() {
      throw new Error("terminal order must not prepare a Stripe session");
    },
    async attachStripeCheckoutSession() {},
  },
  stripe,
);
await assert.rejects(
  () => terminalService.startCheckout(input),
  /COMMERCE_CHECKOUT_NO_LONGER_PENDING/,
);
assert.equal(createCalls, 2, "terminal order replay must not create another Stripe session");

console.log("COMMERCE_CHECKOUT_SERVICE_PASS");
