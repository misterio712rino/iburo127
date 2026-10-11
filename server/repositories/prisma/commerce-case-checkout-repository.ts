import "server-only";

import { randomBytes } from "node:crypto";

import type { Prisma } from "@/generated/prisma/client";
import { getPrismaClient } from "@/server/database/prisma";
import {
  COMMERCE_CASE_CHECKOUT_PENDING,
  COMMERCE_CASE_NOT_FOUND,
  COMMERCE_CASE_PLAN_UNCHANGED,
  COMMERCE_CHECKOUT_IDEMPOTENCY_CONFLICT,
  COMMERCE_CHECKOUT_NO_LONGER_PENDING,
  COMMERCE_PAYMENT_CONCURRENT_UPDATE,
  COMMERCE_PLAN_UNAVAILABLE,
  type CommerceCaseCheckoutOrder,
  type CommercePricingCatalog,
} from "@/server/domain/commerce/contracts";
import {
  normalizeCommerceCheckoutRequestId,
  normalizeCommerceCustomerEmail,
} from "@/server/domain/commerce/order-creation";
import { resolveCommerceCheckoutQuote } from "@/server/domain/commerce/payment-state";

const MAX_TRANSACTION_ATTEMPTS = 4;

type CaseCheckoutOrder = CommerceCaseCheckoutOrder;

function prismaCode(error: unknown, code: string) {
  return typeof error === "object" && error !== null && "code" in error &&
    (error as { code?: unknown }).code === code;
}

function isRetryable(error: unknown) {
  return prismaCode(error, "P2002") || prismaCode(error, "P2034") ||
    (error instanceof Error && error.message === COMMERCE_PAYMENT_CONCURRENT_UPDATE);
}

function newPublicCheckoutId() {
  return "chk_" + randomBytes(24).toString("base64url");
}

function toResult(order: {
  publicCheckoutId: string;
  clientCaseId: string | null;
  plan: { code: string };
  amountMinor: number;
  currency: string;
  offerVersion: string;
  status: string;
  stripeCheckoutSessionId: string | null;
}, replayed: boolean, customerEmail: string): CaseCheckoutOrder {
  if (!order.clientCaseId) throw new Error(COMMERCE_CASE_NOT_FOUND);
  return {
    publicCheckoutId: order.publicCheckoutId,
    clientCaseId: order.clientCaseId,
    planCode: order.plan.code as CaseCheckoutOrder["planCode"],
    amountMinor: order.amountMinor,
    currency: order.currency,
    offerVersion: order.offerVersion,
    status: order.status as CaseCheckoutOrder["status"],
    replayed,
    stripeCheckoutSessionId: order.stripeCheckoutSessionId,
    customerEmail,
  };
}

async function createInTransaction(
  tx: Prisma.TransactionClient,
  input: {
    userId: string;
    clientCaseId: string;
    checkoutRequestId: string;
    planCode: unknown;
    catalog: CommercePricingCatalog;
  },
): Promise<CaseCheckoutOrder> {
  const quote = resolveCommerceCheckoutQuote(input.planCode, input.catalog);
  const clientCase = await tx.clientCase.findUnique({
    where: { id: input.clientCaseId },
    select: {
      id: true,
      clientId: true,
      planId: true,
      client: { select: { email: true } },
    },
  });
  if (!clientCase || clientCase.clientId !== input.userId) {
    throw new Error(COMMERCE_CASE_NOT_FOUND);
  }

  const existing = await tx.commerceOrder.findUnique({
    where: { checkoutRequestId: input.checkoutRequestId },
    include: { plan: { select: { code: true } } },
  });
  if (existing) {
    if (
      existing.userId !== input.userId ||
      existing.clientCaseId !== clientCase.id ||
      existing.plan.code !== quote.planCode ||
      existing.amountMinor !== quote.amountMinor ||
      existing.currency !== quote.currency ||
      existing.offerVersion !== quote.offerVersion
    ) {
      throw new Error(COMMERCE_CHECKOUT_IDEMPOTENCY_CONFLICT);
    }
    return toResult(existing, true, normalizeCommerceCustomerEmail(clientCase.client.email ?? ""));
  }

  const pending = await tx.commerceOrder.findFirst({
    where: { clientCaseId: clientCase.id, status: "PENDING_PAYMENT" },
    include: { plan: { select: { code: true } } },
  });
  if (pending) throw new Error(COMMERCE_CASE_CHECKOUT_PENDING);

  const targetPlan = await tx.plan.findUnique({
    where: { code: quote.planCode },
    select: { id: true, isActive: true },
  });
  if (!targetPlan?.isActive) throw new Error(COMMERCE_PLAN_UNAVAILABLE);
  if (clientCase.planId === targetPlan.id) {
    throw new Error(COMMERCE_CASE_PLAN_UNCHANGED);
  }
  if (!clientCase.client.email) throw new Error(COMMERCE_PLAN_UNAVAILABLE);

  const created = await tx.commerceOrder.create({
    data: {
      publicCheckoutId: newPublicCheckoutId(),
      checkoutRequestId: input.checkoutRequestId,
      planId: targetPlan.id,
      previousPlanId: clientCase.planId,
      userId: input.userId,
      clientCaseId: clientCase.id,
      customerEmail: normalizeCommerceCustomerEmail(clientCase.client.email),
      amountMinor: quote.amountMinor,
      currency: quote.currency,
      offerVersion: quote.offerVersion,
      status: "PENDING_PAYMENT",
    },
    include: { plan: { select: { code: true } } },
  });
  return toResult(created, false, normalizeCommerceCustomerEmail(clientCase.client.email));
}

export class PrismaCommerceCaseCheckoutRepository {
  async createPendingOrder(input: {
    userId: string;
    clientCaseId: string;
    checkoutRequestId: unknown;
    planCode: unknown;
    catalog: CommercePricingCatalog;
  }): Promise<CaseCheckoutOrder> {
    const normalized = {
      userId: input.userId,
      clientCaseId: input.clientCaseId,
      checkoutRequestId: normalizeCommerceCheckoutRequestId(input.checkoutRequestId),
      planCode: input.planCode,
      catalog: input.catalog,
    };
    const prisma = getPrismaClient();
    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
      try {
        return await prisma.$transaction(
          (tx) => createInTransaction(tx, normalized),
          { isolationLevel: "Serializable" },
        );
      } catch (error) {
        lastError = error;
        if (!isRetryable(error) || attempt === MAX_TRANSACTION_ATTEMPTS) throw error;
      }
    }
    throw lastError instanceof Error ? lastError : new Error(COMMERCE_PAYMENT_CONCURRENT_UPDATE);
  }

  async prepareStripeCheckoutSession(input: {
    publicCheckoutId: string;
  }): Promise<{ stripeCheckoutSessionId: string | null; createStartedAt: Date }> {
    const prisma = getPrismaClient();
    const createStartedAt = new Date();
    await prisma.commerceOrder.updateMany({
      where: {
        publicCheckoutId: input.publicCheckoutId,
        status: "PENDING_PAYMENT",
        stripeCheckoutSessionId: null,
        stripeCheckoutSessionCreateStartedAt: null,
      },
      data: { stripeCheckoutSessionCreateStartedAt: createStartedAt },
    });

    const current = await prisma.commerceOrder.findUnique({
      where: { publicCheckoutId: input.publicCheckoutId },
      select: {
        status: true,
        stripeCheckoutSessionId: true,
        stripeCheckoutSessionCreateStartedAt: true,
      },
    });
    if (!current || current.status !== "PENDING_PAYMENT") {
      throw new Error(COMMERCE_CHECKOUT_NO_LONGER_PENDING);
    }
    return {
      stripeCheckoutSessionId: current.stripeCheckoutSessionId,
      createStartedAt: current.stripeCheckoutSessionCreateStartedAt ?? createStartedAt,
    };
  }

  async attachStripeCheckoutSession(input: {
    publicCheckoutId: string;
    stripeCheckoutSessionId: string;
  }): Promise<void> {
    const prisma = getPrismaClient();
    const attached = await prisma.commerceOrder.updateMany({
      where: {
        publicCheckoutId: input.publicCheckoutId,
        status: "PENDING_PAYMENT",
        stripeCheckoutSessionId: null,
      },
      data: { stripeCheckoutSessionId: input.stripeCheckoutSessionId },
    });
    if (attached.count === 1) return;

    const current = await prisma.commerceOrder.findUnique({
      where: { publicCheckoutId: input.publicCheckoutId },
      select: { stripeCheckoutSessionId: true, status: true },
    });
    if (current?.stripeCheckoutSessionId === input.stripeCheckoutSessionId) return;
    if (current?.stripeCheckoutSessionId) {
      throw new Error(COMMERCE_CHECKOUT_IDEMPOTENCY_CONFLICT);
    }
    throw new Error(COMMERCE_CASE_CHECKOUT_PENDING);
  }
}
