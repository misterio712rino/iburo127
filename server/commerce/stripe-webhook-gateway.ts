import "server-only";

import type Stripe from "stripe";
import type { StripeWebhookGateway } from "@/server/domain/commerce/payment-webhook-service";

export class StripeWebhookGatewayImpl implements StripeWebhookGateway {
  constructor(private readonly stripe: Stripe) {}

  constructEvent(rawBody: Buffer, signature: string, secret: string): Stripe.Event {
    return this.stripe.webhooks.constructEvent(rawBody, signature, secret);
  }

  retrievePaymentIntent(id: string): Promise<Stripe.PaymentIntent> {
    return this.stripe.paymentIntents.retrieve(id);
  }
}
