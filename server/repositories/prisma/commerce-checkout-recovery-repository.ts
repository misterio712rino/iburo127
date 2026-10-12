import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { getPrismaClient } from "@/server/database/prisma";
import {
  COMMERCE_CHECKOUT_RECOVERY_CONFLICT,
  COMMERCE_CHECKOUT_RECOVERY_NOT_ELIGIBLE,
  type CheckoutRecoveryCandidate,
  type CommerceCheckoutRecoveryRepository,
} from "@/server/domain/commerce/checkout-recovery-service";

function selectRecoveryCandidate<T extends Prisma.CommerceOrderSelect>(select: T) {
  return select;
}

export class PrismaCommerceCheckoutRecoveryRepository implements CommerceCheckoutRecoveryRepository {
  async getCandidate(publicCheckoutId: string): Promise<CheckoutRecoveryCandidate | null> {
    const order = await getPrismaClient().commerceOrder.findUnique({
      where: { publicCheckoutId },
      select: selectRecoveryCandidate({
        id: true,
        publicCheckoutId: true,
        clientCaseId: true,
        amountMinor: true,
        currency: true,
        status: true,
        stripeCheckoutSessionId: true,
        stripeCheckoutSessionCreateStartedAt: true,
        _count: { select: { payments: true, events: true } },
        checkoutSessionRecovery: { select: { stripeCheckoutSessionId: true } },
      }),
    });
    if (!order) return null;
    return {
      id: order.id,
      publicCheckoutId: order.publicCheckoutId,
      clientCaseId: order.clientCaseId,
      amountMinor: order.amountMinor,
      currency: order.currency,
      status: order.status,
      stripeCheckoutSessionId: order.stripeCheckoutSessionId,
      createStartedAt: order.stripeCheckoutSessionCreateStartedAt,
      paymentCount: order._count.payments,
      eventCount: order._count.events,
      recoveredSessionId: order.checkoutSessionRecovery?.stripeCheckoutSessionId ?? null,
    };
  }

  async attachExistingSession(input: {
    orderId: string;
    publicCheckoutId: string;
    stripeCheckoutSessionId: string;
    expectedCreateStartedAt: Date;
    cutoff: Date;
    operatorUserId: string;
    evidenceReference: string;
  }): Promise<void> {
    const prisma = getPrismaClient();
    await prisma.$transaction(async (tx) => {
      const current = await tx.commerceOrder.findUnique({
        where: { id: input.orderId },
        select: {
          publicCheckoutId: true,
          clientCaseId: true,
          amountMinor: true,
          currency: true,
          status: true,
          stripeCheckoutSessionId: true,
          stripeCheckoutSessionCreateStartedAt: true,
          _count: { select: { payments: true, events: true } },
          checkoutSessionRecovery: { select: { stripeCheckoutSessionId: true } },
        },
      });
      if (
        !current ||
        current.publicCheckoutId !== input.publicCheckoutId ||
        current.status !== "PENDING_PAYMENT" ||
        current.stripeCheckoutSessionId !== null ||
        current.stripeCheckoutSessionCreateStartedAt?.getTime() !== input.expectedCreateStartedAt.getTime() ||
        current.stripeCheckoutSessionCreateStartedAt > input.cutoff ||
        current._count.payments !== 0 ||
        current._count.events !== 0 ||
        current.checkoutSessionRecovery
      ) {
        throw new Error(COMMERCE_CHECKOUT_RECOVERY_NOT_ELIGIBLE);
      }

      const attached = await tx.commerceOrder.updateMany({
        where: {
          id: input.orderId,
          publicCheckoutId: input.publicCheckoutId,
          status: "PENDING_PAYMENT",
          stripeCheckoutSessionId: null,
          stripeCheckoutSessionCreateStartedAt: {
            equals: input.expectedCreateStartedAt,
            lte: input.cutoff,
          },
        },
        data: { stripeCheckoutSessionId: input.stripeCheckoutSessionId },
      });
      if (attached.count !== 1) throw new Error(COMMERCE_CHECKOUT_RECOVERY_CONFLICT);

      try {
        await tx.commerceCheckoutSessionRecovery.create({
          data: {
            orderId: input.orderId,
            operatorUserId: input.operatorUserId,
            stripeCheckoutSessionId: input.stripeCheckoutSessionId,
            evidenceReference: input.evidenceReference,
          },
        });
      } catch (error) {
        if (
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          (error as { code?: unknown }).code === "P2002"
        ) throw new Error(COMMERCE_CHECKOUT_RECOVERY_CONFLICT);
        throw error;
      }
    }, { isolationLevel: "Serializable" });
  }
}
