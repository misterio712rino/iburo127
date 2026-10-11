import "server-only";

import { getStripeClient } from "@/server/commerce/stripe-client";
import { CommerceCheckoutRecoveryService } from "@/server/domain/commerce/checkout-recovery-service";
import { PrismaCommerceCheckoutRecoveryRepository } from "@/server/repositories/prisma/commerce-checkout-recovery-repository";

export function getCommerceCheckoutRecoveryService() {
  const stripe = getStripeClient();
  return new CommerceCheckoutRecoveryService(
    new PrismaCommerceCheckoutRecoveryRepository(),
    {
      async retrieveSession(id) {
        const session = await stripe.checkout.sessions.retrieve(id);
        return {
          id: session.id,
          url: session.url,
          status: session.status === "open" ? "open" : session.status === "complete" ? "complete" : "expired",
          mode: session.mode,
          clientReferenceId: session.client_reference_id,
          metadata: session.metadata
            ? {
                publicCheckoutId: session.metadata.publicCheckoutId ?? undefined,
                clientCaseId: session.metadata.clientCaseId ?? undefined,
              }
            : null,
          amountTotal: session.amount_total,
          currency: session.currency,
        };
      },
    },
  );
}
