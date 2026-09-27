import { randomBytes } from "node:crypto";

import { getPrismaClient } from "@/server/database/prisma";
import {
  COMMERCE_CHECKOUT_IDEMPOTENCY_CONFLICT,
  COMMERCE_PLAN_UNAVAILABLE,
  type CommerceCreatedOrder,
  type CommercePricingCatalog,
} from "@/server/domain/commerce/contracts";
import {
  normalizeCommerceCheckoutRequestId,
  normalizeCommerceCustomerEmail,
} from "@/server/domain/commerce/order-creation";
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

type ExistingCheckoutOrder = {
  publicCheckoutId: string;
  planId: string;
  customerEmail: string;
  amountMinor: number;
  currency: string;
  offerVersion: string;
  status: CommerceCreatedOrder["status"];
};

function replayResult(
  order: ExistingCheckoutOrder,
  input: {
    planId: string;
    planCode: CommerceCreatedOrder["planCode"];
    customerEmail: string;
    amountMinor: number;
    currency: string;
    offerVersion: string;
  },
): CommerceCreatedOrder {
  if (
    order.planId !== input.planId ||
    order.customerEmail !== input.customerEmail ||
    order.amountMinor !== input.amountMinor ||
    order.currency !== input.currency ||
    order.offerVersion !== input.offerVersion
  ) {
    throw new Error(COMMERCE_CHECKOUT_IDEMPOTENCY_CONFLICT);
  }

  return {
    publicCheckoutId: order.publicCheckoutId,
    planCode: input.planCode,
    amountMinor: order.amountMinor,
    currency: order.currency,
    offerVersion: order.offerVersion,
    status: order.status,
    replayed: true,
  };
}

export class PrismaCommerceOrderRepository {
  async createPendingOrder(input: {
    planCode: unknown;
    customerEmail: unknown;
    checkoutRequestId: unknown;
    catalog: CommercePricingCatalog;
  }): Promise<CommerceCreatedOrder> {
    const quote = resolveCommerceCheckoutQuote(input.planCode, input.catalog);
    const customerEmail = normalizeCommerceCustomerEmail(input.customerEmail);
    const checkoutRequestId = normalizeCommerceCheckoutRequestId(input.checkoutRequestId);
    const prisma = getPrismaClient();

    const plan = await prisma.plan.findUnique({
      where: { code: quote.planCode },
      select: { id: true, isActive: true },
    });
    if (!plan?.isActive) {
      throw new Error(COMMERCE_PLAN_UNAVAILABLE);
    }

    const existing = await prisma.commerceOrder.findUnique({
      where: { checkoutRequestId },
      select: {
        publicCheckoutId: true,
        planId: true,
        customerEmail: true,
        amountMinor: true,
        currency: true,
        offerVersion: true,
        status: true,
      },
    });
    if (existing) {
      return replayResult(existing, {
        planId: plan.id,
        planCode: quote.planCode,
        customerEmail,
        amountMinor: quote.amountMinor,
        currency: quote.currency,
        offerVersion: quote.offerVersion,
      });
    }

    for (let attempt = 1; attempt <= MAX_PUBLIC_ID_ATTEMPTS; attempt += 1) {
      const publicCheckoutId = generatePublicCheckoutId();
      try {
        const order = await prisma.commerceOrder.create({
          data: {
            publicCheckoutId,
            checkoutRequestId,
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
          status: order.status,
          replayed: false,
        };
      } catch (error) {
        if (!isUniqueConstraintViolation(error)) {
          throw error;
        }

        const raced = await prisma.commerceOrder.findUnique({
          where: { checkoutRequestId },
          select: {
            publicCheckoutId: true,
            planId: true,
            customerEmail: true,
            amountMinor: true,
            currency: true,
            offerVersion: true,
            status: true,
          },
        });
        if (raced) {
          return replayResult(raced, {
            planId: plan.id,
            planCode: quote.planCode,
            customerEmail,
            amountMinor: quote.amountMinor,
            currency: quote.currency,
            offerVersion: quote.offerVersion,
          });
        }

        if (attempt === MAX_PUBLIC_ID_ATTEMPTS) throw error;
      }
    }

    throw new Error(COMMERCE_PLAN_UNAVAILABLE);
  }
}
