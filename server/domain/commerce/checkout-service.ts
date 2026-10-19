import "server-only";

import {
  COMMERCE_CHECKOUT_NO_LONGER_PENDING,
  COMMERCE_CHECKOUT_SESSION_RECOVERY_REQUIRED,
  type CommerceCaseCheckoutOrder,
  type CommercePricingCatalog,
} from "@/server/domain/commerce/contracts";

export type StripeCheckoutSession = {
  id: string;
  url: string | null;
  status: "open" | "complete" | "expired";
};

export interface CommerceCaseCheckoutRepository {
  createPendingOrder(input: {
    userId: string;
    clientCaseId: string;
    checkoutRequestId: unknown;
    planCode: unknown;
    catalog: CommercePricingCatalog;
  }): Promise<CommerceCaseCheckoutOrder>;
  prepareStripeCheckoutSession(input: {
    publicCheckoutId: string;
  }): Promise<{
    stripeCheckoutSessionId: string | null;
    createStartedAt: Date;
  }>;
  attachStripeCheckoutSession(input: {
    publicCheckoutId: string;
    stripeCheckoutSessionId: string;
  }): Promise<void>;
}

// Stripe may prune idempotency keys after 24 hours. Stop retries four hours early.
export const STRIPE_CHECKOUT_IDEMPOTENCY_SAFE_WINDOW_MS = 20 * 60 * 60 * 1000;

export interface CommerceStripeCheckoutGateway {
  createSession(input: {
    order: CommerceCaseCheckoutOrder;
    customerEmail: string;
    origin: string;
  }): Promise<StripeCheckoutSession>;
  retrieveSession(id: string): Promise<StripeCheckoutSession>;
}

export class CommerceCheckoutService {
  constructor(
    private readonly repository: CommerceCaseCheckoutRepository,
    private readonly stripe: CommerceStripeCheckoutGateway,
  ) {}

  async startCheckout(input: {
    userId: string;
    clientCaseId: string;
    requestId: string;
    planCode: string;
    catalog: CommercePricingCatalog;
    origin: string;
  }) {
    const order = await this.repository.createPendingOrder({
      userId: input.userId,
      clientCaseId: input.clientCaseId,
      checkoutRequestId: input.requestId,
      planCode: input.planCode,
      catalog: input.catalog,
    });

    if (order.status !== "PENDING_PAYMENT") {
      throw new Error(COMMERCE_CHECKOUT_NO_LONGER_PENDING);
    }

    let session: StripeCheckoutSession;
    if (order.stripeCheckoutSessionId) {
      session = await this.stripe.retrieveSession(order.stripeCheckoutSessionId);
    } else {
      const prepared = await this.repository.prepareStripeCheckoutSession({
        publicCheckoutId: order.publicCheckoutId,
      });
      if (prepared.stripeCheckoutSessionId) {
        session = await this.stripe.retrieveSession(prepared.stripeCheckoutSessionId);
      } else {
        const attemptAge = Date.now() - prepared.createStartedAt.getTime();
        if (attemptAge >= STRIPE_CHECKOUT_IDEMPOTENCY_SAFE_WINDOW_MS) {
          throw new Error(COMMERCE_CHECKOUT_SESSION_RECOVERY_REQUIRED);
        }
        session = await this.stripe.createSession({
          order,
          customerEmail: order.customerEmail,
          origin: input.origin,
        });
      }
    }

    if (session.status !== "open" || !session.url || !session.url.startsWith("https://checkout.stripe.com/")) {
      throw new Error("COMMERCE_CHECKOUT_SESSION_UNAVAILABLE");
    }

    if (!order.stripeCheckoutSessionId) {
      await this.repository.attachStripeCheckoutSession({
        publicCheckoutId: order.publicCheckoutId,
        stripeCheckoutSessionId: session.id,
      });
    }

    return {
      order,
      checkoutUrl: session.url,
      replayed: order.replayed,
    };
  }
}
