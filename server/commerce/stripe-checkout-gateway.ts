import "server-only";

import type Stripe from "stripe";

import type { CommerceCaseCheckoutOrder } from "@/server/domain/commerce/contracts";
import type { CommerceStripeCheckoutGateway, StripeCheckoutSession } from "@/server/domain/commerce/checkout-service";

function sessionResult(session: Stripe.Checkout.Session): StripeCheckoutSession {
  let status: StripeCheckoutSession["status"] = "expired";
  if (session.status === "open") status = "open";
  else if (session.status === "complete") status = "complete";
  return { id: session.id, url: session.url, status };
}

export class StripeCheckoutGateway implements CommerceStripeCheckoutGateway {
  constructor(private readonly stripe: Stripe) {}

  async createSession(input: {
    order: CommerceCaseCheckoutOrder;
    customerEmail: string;
    origin: string;
  }): Promise<StripeCheckoutSession> {
    const metadata = {
      clientCaseId: input.order.clientCaseId,
      publicCheckoutId: input.order.publicCheckoutId,
    };
    const session = await this.stripe.checkout.sessions.create(
      {
        mode: "payment",
        customer_email: input.customerEmail,
        client_reference_id: input.order.publicCheckoutId,
        line_items: [{
          quantity: 1,
          price_data: {
            currency: input.order.currency.toLowerCase(),
            unit_amount: input.order.amountMinor,
            product_data: {
              name: "Тариф " + input.order.planCode,
              description: "Оформление тарифа по делу",
            },
          },
        }],
        metadata,
        payment_intent_data: { metadata },
        success_url: new URL(
          `/portal/cases/${encodeURIComponent(input.order.clientCaseId)}?checkout=success`,
          input.origin,
        ).toString(),
        cancel_url: new URL(
          `/portal/cases/${encodeURIComponent(input.order.clientCaseId)}?checkout=cancelled`,
          input.origin,
        ).toString(),
      },
      { idempotencyKey: "iburo-commerce-checkout:" + input.order.publicCheckoutId },
    );
    return sessionResult(session);
  }

  async retrieveSession(id: string): Promise<StripeCheckoutSession> {
    return sessionResult(await this.stripe.checkout.sessions.retrieve(id));
  }
}
