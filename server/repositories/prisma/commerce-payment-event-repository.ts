import type { Prisma } from "@/generated/prisma/client";
import { getPrismaClient } from "@/server/database/prisma";
import {
  COMMERCE_ORDER_NOT_FOUND,
  COMMERCE_PAYMENT_AMOUNT_MISMATCH,
  COMMERCE_PAYMENT_CONCURRENT_UPDATE,
  COMMERCE_PAYMENT_CURRENCY_MISMATCH,
  COMMERCE_PAYMENT_EVENT_CONFLICT,
  COMMERCE_PAYMENT_IDENTITY_CONFLICT,
  COMMERCE_UNSUPPORTED_PLAN,
  COMMERCE_ONLINE_PLAN_CODES,
  type CommerceOnlinePlanCode,
  type CommerceOrderSnapshot,
  type CommercePaymentEventProcessingStatus,
  type CommercePaymentSnapshot,
  type CommerceVerifiedEventProcessingResult,
  type VerifiedCommercePaymentEvent,
} from "@/server/domain/commerce/contracts";
import {
  applyVerifiedCommercePaymentEvent,
  normalizeVerifiedCommercePaymentEvent,
} from "@/server/domain/commerce/payment-state";

const MAX_TRANSACTION_ATTEMPTS = 4;

function isPrismaCode(error: unknown, code: string) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === code
  );
}

function isRetryableRace(error: unknown) {
  return (
    isPrismaCode(error, "P2002") ||
    isPrismaCode(error, "P2034") ||
    (error instanceof Error && error.message === COMMERCE_PAYMENT_CONCURRENT_UPDATE)
  );
}

function isRejectableVerifiedEventError(error: unknown): error is Error {
  return (
    error instanceof Error &&
    (error.message === COMMERCE_PAYMENT_AMOUNT_MISMATCH ||
      error.message === COMMERCE_PAYMENT_CURRENCY_MISMATCH ||
      error.message === COMMERCE_PAYMENT_IDENTITY_CONFLICT)
  );
}

function toPlanCode(value: string): CommerceOnlinePlanCode {
  if (!COMMERCE_ONLINE_PLAN_CODES.includes(value as CommerceOnlinePlanCode)) {
    throw new Error(COMMERCE_UNSUPPORTED_PLAN);
  }
  return value as CommerceOnlinePlanCode;
}

function sameInstant(left: Date, right: Date) {
  return left.getTime() === right.getTime();
}

function eventMatchesExisting(
  existing: {
    orderId: string;
    providerPaymentId: string;
    kind: string;
    amountMinor: number;
    currency: string;
    providerOccurredAt: Date;
    rawBodySha256: string;
  },
  orderId: string,
  event: VerifiedCommercePaymentEvent,
) {
  return (
    existing.orderId === orderId &&
    existing.providerPaymentId === event.paymentId &&
    existing.kind === event.kind &&
    existing.amountMinor === event.amountMinor &&
    existing.currency === event.currency &&
    sameInstant(existing.providerOccurredAt, event.occurredAt) &&
    existing.rawBodySha256 === event.rawBodySha256
  );
}

function paymentSnapshot(
  payment: {
    provider: string;
    providerPaymentId: string;
    amountMinor: number;
    currency: string;
    status: string;
    providerOccurredAt: Date | null;
  } | null,
): CommercePaymentSnapshot | null {
  if (!payment) return null;
  return {
    provider: payment.provider,
    paymentId: payment.providerPaymentId,
    amountMinor: payment.amountMinor,
    currency: payment.currency,
    status: payment.status as CommercePaymentSnapshot["status"],
    providerOccurredAt: payment.providerOccurredAt,
  };
}

function orderSnapshot(order: {
  publicCheckoutId: string;
  amountMinor: number;
  currency: string;
  status: string;
  plan: { code: string };
}): CommerceOrderSnapshot {
  return {
    publicCheckoutId: order.publicCheckoutId,
    planCode: toPlanCode(order.plan.code),
    amountMinor: order.amountMinor,
    currency: order.currency,
    status: order.status as CommerceOrderSnapshot["status"],
  };
}

function paidAtForStatus(
  current: Date | null,
  status: CommercePaymentSnapshot["status"],
  eventTime: Date,
) {
  return current ?? (status === "SUCCEEDED" ? eventTime : null);
}

function refundedAtForStatus(
  current: Date | null,
  status: CommercePaymentSnapshot["status"],
  eventTime: Date,
) {
  return current ?? (status === "REFUNDED" || status === "CHARGEBACK" ? eventTime : null);
}

async function processInTransaction(
  tx: Prisma.TransactionClient,
  event: VerifiedCommercePaymentEvent,
): Promise<CommerceVerifiedEventProcessingResult> {
  const order = await tx.commerceOrder.findUnique({
    where: { publicCheckoutId: event.publicCheckoutId },
    include: {
      plan: {
        select: { code: true },
      },
    },
  });
  if (!order) throw new Error(COMMERCE_ORDER_NOT_FOUND);

  const existingEvent = await tx.commercePaymentEvent.findUnique({
    where: {
      provider_providerEventId: {
        provider: event.provider,
        providerEventId: event.eventId,
      },
    },
  });

  if (existingEvent) {
    if (!eventMatchesExisting(existingEvent, order.id, event)) {
      throw new Error(COMMERCE_PAYMENT_EVENT_CONFLICT);
    }

    const currentPayment = await tx.commercePayment.findUnique({
      where: {
        provider_providerPaymentId: {
          provider: event.provider,
          providerPaymentId: event.paymentId,
        },
      },
    });

    return {
      replay: true,
      processingStatus:
        existingEvent.processingStatus as CommercePaymentEventProcessingStatus,
      rejectionCode: existingEvent.rejectionCode,
      paymentStatus: currentPayment
        ? (currentPayment.status as CommercePaymentSnapshot["status"])
        : null,
      orderStatus: order.status as CommerceOrderSnapshot["status"],
      orderBecamePaid: false,
      shouldPauseProvisionedCase: false,
    };
  }

  const existingPayment = await tx.commercePayment.findUnique({
    where: {
      provider_providerPaymentId: {
        provider: event.provider,
        providerPaymentId: event.paymentId,
      },
    },
  });

  const receivedEvent = await tx.commercePaymentEvent.create({
    data: {
      orderId: order.id,
      paymentId: existingPayment?.id ?? null,
      provider: event.provider,
      providerEventId: event.eventId,
      providerPaymentId: event.paymentId,
      kind: event.kind,
      amountMinor: event.amountMinor,
      currency: event.currency,
      providerOccurredAt: event.occurredAt,
      rawBodySha256: event.rawBodySha256,
      verifiedAt: new Date(),
      processingStatus: "RECEIVED",
    },
    select: { id: true },
  });

  let transition;
  try {
    transition = applyVerifiedCommercePaymentEvent({
      order: orderSnapshot(order),
      payment: paymentSnapshot(existingPayment),
      event,
    });
  } catch (error) {
    if (!isRejectableVerifiedEventError(error)) throw error;

    await tx.commercePaymentEvent.update({
      where: { id: receivedEvent.id },
      data: {
        processingStatus: "REJECTED",
        rejectionCode: error.message,
        processedAt: new Date(),
      },
    });

    return {
      replay: false,
      processingStatus: "REJECTED",
      rejectionCode: error.message,
      paymentStatus: existingPayment
        ? (existingPayment.status as CommercePaymentSnapshot["status"])
        : null,
      orderStatus: order.status as CommerceOrderSnapshot["status"],
      orderBecamePaid: false,
      shouldPauseProvisionedCase: false,
    };
  }

  let paymentId = existingPayment?.id ?? null;

  if (!existingPayment) {
    const createdPayment = await tx.commercePayment.create({
      data: {
        orderId: order.id,
        provider: event.provider,
        providerPaymentId: event.paymentId,
        amountMinor: event.amountMinor,
        currency: event.currency,
        status: transition.paymentStatus,
        providerOccurredAt: transition.providerOccurredAt,
        paidAt: paidAtForStatus(null, transition.paymentStatus, event.occurredAt),
        refundedAt: refundedAtForStatus(null, transition.paymentStatus, event.occurredAt),
      },
      select: { id: true },
    });
    paymentId = createdPayment.id;
  } else if (transition.applied) {
    const updatedPayment = await tx.commercePayment.updateMany({
      where: {
        id: existingPayment.id,
        status: existingPayment.status,
        providerOccurredAt: existingPayment.providerOccurredAt,
      },
      data: {
        status: transition.paymentStatus,
        providerOccurredAt: transition.providerOccurredAt,
        paidAt: paidAtForStatus(
          existingPayment.paidAt,
          transition.paymentStatus,
          event.occurredAt,
        ),
        refundedAt: refundedAtForStatus(
          existingPayment.refundedAt,
          transition.paymentStatus,
          event.occurredAt,
        ),
      },
    });
    if (updatedPayment.count !== 1) {
      throw new Error(COMMERCE_PAYMENT_CONCURRENT_UPDATE);
    }
  }

  if (transition.orderStatus !== order.status) {
    const updatedOrder = await tx.commerceOrder.updateMany({
      where: {
        id: order.id,
        status: order.status,
        version: order.version,
      },
      data: {
        status: transition.orderStatus,
        version: { increment: 1 },
        ...(transition.orderStatus === "PAID" && order.paidAt === null
          ? { paidAt: event.occurredAt }
          : {}),
        ...((transition.orderStatus === "REFUNDED" ||
          transition.orderStatus === "CHARGEBACK") &&
        order.refundedAt === null
          ? { refundedAt: event.occurredAt }
          : {}),
      },
    });
    if (updatedOrder.count !== 1) {
      throw new Error(COMMERCE_PAYMENT_CONCURRENT_UPDATE);
    }
  }

  await tx.commercePaymentEvent.update({
    where: { id: receivedEvent.id },
    data: {
      paymentId,
      processingStatus: transition.stale ? "IGNORED" : "APPLIED",
      rejectionCode: null,
      processedAt: new Date(),
    },
  });

  return {
    replay: false,
    processingStatus: transition.stale ? "IGNORED" : "APPLIED",
    rejectionCode: null,
    paymentStatus: transition.paymentStatus,
    orderStatus: transition.orderStatus,
    orderBecamePaid: transition.orderBecamePaid,
    shouldPauseProvisionedCase: transition.shouldPauseProvisionedCase,
  };
}

export class PrismaCommercePaymentEventRepository {
  async processVerifiedEvent(
    input: VerifiedCommercePaymentEvent,
  ): Promise<CommerceVerifiedEventProcessingResult> {
    const event = normalizeVerifiedCommercePaymentEvent(input);
    const prisma = getPrismaClient();
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
      try {
        return await prisma.$transaction(
          (tx) => processInTransaction(tx, event),
          { isolationLevel: "Serializable" },
        );
      } catch (error) {
        lastError = error;
        if (!isRetryableRace(error) || attempt === MAX_TRANSACTION_ATTEMPTS) {
          throw error;
        }
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error(COMMERCE_PAYMENT_CONCURRENT_UPDATE);
  }
}
