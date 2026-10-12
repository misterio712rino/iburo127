import "server-only";

import type Stripe from "stripe";

import {
  STRIPE_SIGNATURE_INVALID,
  eventFromStripe,
} from "@/server/domain/commerce/stripe-payment-event";
import type { VerifiedCommercePaymentEvent } from "@/server/domain/commerce/contracts";

export interface CommercePaymentEventRepository {
  processVerifiedEvent(event: VerifiedCommercePaymentEvent): Promise<unknown>;
}

export interface StripeWebhookGateway {
  constructEvent(rawBody: Buffer, signature: string, secret: string): Stripe.Event;
  retrievePaymentIntent(id: string): Promise<Stripe.PaymentIntent>;
}

export class StripeWebhookService {
  constructor(
    private readonly repository: CommercePaymentEventRepository,
    private readonly stripe: StripeWebhookGateway,
    private readonly webhookSecret: string,
  ) {}

  async handle(rawBody: Buffer, signature: string | null) {
    if (rawBody.length === 0 || !signature?.trim()) throw new Error(STRIPE_SIGNATURE_INVALID);

    let stripeEvent: Stripe.Event;
    try {
      stripeEvent = this.stripe.constructEvent(rawBody, signature, this.webhookSecret);
    } catch {
      throw new Error(STRIPE_SIGNATURE_INVALID);
    }

    const verifiedEvent: VerifiedCommercePaymentEvent | null = await eventFromStripe(
      stripeEvent,
      rawBody,
      (id) => this.stripe.retrievePaymentIntent(id),
    );
    if (!verifiedEvent) return { ignored: true, eventId: stripeEvent.id };

    const result = await this.repository.processVerifiedEvent(verifiedEvent);
    return { ignored: false, eventId: stripeEvent.id, result };
  }
}
