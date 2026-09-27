import { randomBytes } from "node:crypto";

import { getPrismaClient } from "@/server/database/prisma";
import {
  COMMERCE_PLAN_UNAVAILABLE,
  type CommerceCreatedOrder,
  type CommercePricingCatalog,
} from "@/server/domain/commerce/contracts";
import { normalizeCommerceCustomerEmail } from "@/server/domain/commerce/order-creation";
import { resolveCommerceCheckoutQuote } from "@/server/domain/commerce/payment-state";

const MAX_PUBLIC_ID_ATTEMPTS = 4;

function isUniqueConstraintViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

function generatePublicCheckoutId() {
  return `chk_${randomBytes(24).toString("base64url")}`;
}

export class PrismaCommerceOrderRepository {
  async createPendingOrder(input: {
    planCode: unknown;
    customerEmail: unknown;
    catalog: CommercePricingCatalog;
  }): Promise<CommerceCreatedOrder> {
    const quote = resolveCommerceCheckoutQuote(input.planCode, input.catalog);
    const customerEmail = normalizeCommerceCustomerEmail(input.customerEmail);
    const prisma = getPrismaClient();

    const plan = await prisma.plan.findUnique({
      where: { code: quote.planCode },
      select: { id: true, isActive: true },
    });
    if (!plan?.isActive) {
      throw new Error(COMMERCE_PLAN_UNAVAILABLE);
    }

    for (let attempt = 1; attempt <= MAX_PUBLIC_ID_ATTEMPTS; attempt += 1) {
      const publicCheckoutId = generatePublicCheckoutId();
      try {
        const order = await prisma.commerceOrder.create({
          data: {
            publicCheckoutId,
            planId: plan.id,
            customerEmail,
            amountMinor: quote.amountMinor,
            currency: quote.currency,
            offerVersion: quote.offerVersion,
            status: "PENDING_PAYMENT",
          },
          select: {
            publicCheckoutId: true,
            amountMinor: true,
            currency: true,
            offerVersion: true,
            status: true,
          },
        });

        return {
          publicCheckoutId: order.publicCheckoutId,
          planCode: quote.planCode,
          amountMinor: order.amountMinor,
          currency: order.currency,
          offerVersion: order.offerVersion,
          status: "PENDING_PAYMENT",
        };
      } catch (error) {
        if (!isUniqueConstraintViolation(error) || attempt === MAX_PUBLIC_ID_ATTEMPTS) {
          throw error;
        }
      }
    }

    throw new Error(COMMERCE_PLAN_UNAVAILABLE);
  }
}
