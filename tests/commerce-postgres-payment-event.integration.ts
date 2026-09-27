import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { getPrismaClient } from "@/server/database/prisma";
import {
  COMMERCE_PAYMENT_AMOUNT_MISMATCH,
  COMMERCE_PAYMENT_EVENT_CONFLICT,
  type VerifiedCommercePaymentEvent,
} from "@/server/domain/commerce/contracts";
import { PrismaCommercePaymentEventRepository } from "@/server/repositories/prisma/commerce-payment-event-repository";

const prisma = getPrismaClient();
const repository = new PrismaCommercePaymentEventRepository();
const runId = randomUUID();
const provider = "provider-test";
const amountMinor = 799_000;
const currency = "RUB";
const offerVersion = "offer-test-v1";
const t1 = new Date("2026-09-27T01:00:00.000Z");
const t2 = new Date("2026-09-27T01:01:00.000Z");
const t3 = new Date("2026-09-27T01:02:00.000Z");
const t4 = new Date("2026-09-27T01:03:00.000Z");

async function ensurePlan() {
  return prisma.plan.upsert({
    where: { code: "LITE" },
    update: { name: "Лайт" },
    create: { code: "LITE", name: "Лайт" },
    select: { id: true },
  });
}

async function createOrder(label: string) {
  const plan = await ensurePlan();
  return prisma.commerceOrder.create({
    data: {
      publicCheckoutId: `checkout-${label}-${runId}`,
      planId: plan.id,
      customerEmail: `commerce-${label}-${runId}@example.test`,
      amountMinor,
      currency,
      offerVersion,
    },
  });
}

function event(
  order: { publicCheckoutId: string },
  label: string,
  kind: VerifiedCommercePaymentEvent["kind"],
  occurredAt: Date,
  overrides: Partial<VerifiedCommercePaymentEvent> = {},
): VerifiedCommercePaymentEvent {
  return {
    provider,
    eventId: `event-${label}-${kind}-${occurredAt.getTime()}-${runId}`,
    paymentId: `payment-${label}-${runId}`,
    publicCheckoutId: order.publicCheckoutId,
    kind,
    amountMinor,
    currency,
    occurredAt,
    rawBodySha256: "a".repeat(64),
    ...overrides,
  };
}

async function scenarioAppliedAndReplay() {
  const order = await createOrder("replay");
  const input = event(order, "replay", "SUCCEEDED", t1);

  const first = await repository.processVerifiedEvent(input);
  const second = await repository.processVerifiedEvent(input);

  assert.deepEqual(
    {
      replay: first.replay,
      processingStatus: first.processingStatus,
      paymentStatus: first.paymentStatus,
      orderStatus: first.orderStatus,
      orderBecamePaid: first.orderBecamePaid,
    },
    {
      replay: false,
      processingStatus: "APPLIED",
      paymentStatus: "SUCCEEDED",
      orderStatus: "PAID",
      orderBecamePaid: true,
    },
  );
  assert.equal(second.replay, true);
  assert.equal(second.processingStatus, "APPLIED");
  assert.equal(second.paymentStatus, "SUCCEEDED");
  assert.equal(second.orderStatus, "PAID");
  assert.equal(second.orderBecamePaid, false);
  assert.equal(second.shouldPauseProvisionedCase, false);

  const [eventCount, paymentCount, persistedOrder] = await Promise.all([
    prisma.commercePaymentEvent.count({ where: { orderId: order.id } }),
    prisma.commercePayment.count({ where: { orderId: order.id } }),
    prisma.commerceOrder.findUniqueOrThrow({ where: { id: order.id } }),
  ]);
  assert.equal(eventCount, 1);
  assert.equal(paymentCount, 1);
  assert.equal(persistedOrder.status, "PAID");
  assert.equal(persistedOrder.version, 2);
  assert.ok(persistedOrder.paidAt instanceof Date);
}

async function scenarioConcurrentDuplicate() {
  const order = await createOrder("concurrent-replay");
  const input = event(order, "concurrent-replay", "SUCCEEDED", t1);

  const results = await Promise.all([
    repository.processVerifiedEvent(input),
    repository.processVerifiedEvent(input),
  ]);

  assert.equal(results.filter((result) => result.orderBecamePaid).length, 1);
  assert.equal(results.filter((result) => result.replay).length, 1);
  assert.ok(results.every((result) => result.orderStatus === "PAID"));

  const [eventCount, paymentCount, persistedOrder] = await Promise.all([
    prisma.commercePaymentEvent.count({ where: { orderId: order.id } }),
    prisma.commercePayment.count({ where: { orderId: order.id } }),
    prisma.commerceOrder.findUniqueOrThrow({ where: { id: order.id } }),
  ]);
  assert.equal(eventCount, 1);
  assert.equal(paymentCount, 1);
  assert.equal(persistedOrder.version, 2);
}

async function scenarioRejectedMismatch() {
  const order = await createOrder("mismatch");
  const input = event(order, "mismatch", "SUCCEEDED", t1, {
    amountMinor: amountMinor + 1,
  });

  const first = await repository.processVerifiedEvent(input);
  const replay = await repository.processVerifiedEvent(input);

  assert.equal(first.processingStatus, "REJECTED");
  assert.equal(first.rejectionCode, COMMERCE_PAYMENT_AMOUNT_MISMATCH);
  assert.equal(first.paymentStatus, null);
  assert.equal(first.orderStatus, "PENDING_PAYMENT");
  assert.equal(first.orderBecamePaid, false);
  assert.equal(replay.replay, true);
  assert.equal(replay.processingStatus, "REJECTED");
  assert.equal(replay.rejectionCode, COMMERCE_PAYMENT_AMOUNT_MISMATCH);

  const [events, payments, persistedOrder] = await Promise.all([
    prisma.commercePaymentEvent.findMany({ where: { orderId: order.id } }),
    prisma.commercePayment.count({ where: { orderId: order.id } }),
    prisma.commerceOrder.findUniqueOrThrow({ where: { id: order.id } }),
  ]);
  assert.equal(events.length, 1);
  assert.equal(events[0].processingStatus, "REJECTED");
  assert.equal(events[0].rejectionCode, COMMERCE_PAYMENT_AMOUNT_MISMATCH);
  assert.equal(payments, 0);
  assert.equal(persistedOrder.status, "PENDING_PAYMENT");
  assert.equal(persistedOrder.version, 1);
}

async function scenarioEventIdConflict() {
  const order = await createOrder("event-conflict");
  const first = event(order, "event-conflict", "FAILED", t1);
  await repository.processVerifiedEvent(first);

  await assert.rejects(
    repository.processVerifiedEvent({
      ...first,
      kind: "SUCCEEDED",
      rawBodySha256: "b".repeat(64),
    }),
    new RegExp(COMMERCE_PAYMENT_EVENT_CONFLICT),
  );

  assert.equal(
    await prisma.commercePaymentEvent.count({ where: { orderId: order.id } }),
    1,
  );
}

async function scenarioOutOfOrderMonotonicRecovery() {
  const order = await createOrder("out-of-order");
  const failed = event(order, "out-of-order", "FAILED", t3);
  const delayedSuccess = event(order, "out-of-order-success", "SUCCEEDED", t2, {
    paymentId: failed.paymentId,
  });
  const newerFailure = event(order, "out-of-order-new-failure", "FAILED", t4, {
    paymentId: failed.paymentId,
  });
  const delayedRefund = event(order, "out-of-order-refund", "REFUNDED", t3, {
    paymentId: failed.paymentId,
  });

  const failedResult = await repository.processVerifiedEvent(failed);
  assert.equal(failedResult.paymentStatus, "FAILED");
  assert.equal(failedResult.orderStatus, "PAYMENT_FAILED");

  const successResult = await repository.processVerifiedEvent(delayedSuccess);
  assert.equal(successResult.processingStatus, "APPLIED");
  assert.equal(successResult.paymentStatus, "SUCCEEDED");
  assert.equal(successResult.orderStatus, "PAID");
  assert.equal(successResult.orderBecamePaid, true);

  const newerFailureResult = await repository.processVerifiedEvent(newerFailure);
  assert.equal(newerFailureResult.processingStatus, "APPLIED");
  assert.equal(newerFailureResult.paymentStatus, "SUCCEEDED");
  assert.equal(newerFailureResult.orderStatus, "PAID");

  const refundResult = await repository.processVerifiedEvent(delayedRefund);
  assert.equal(refundResult.processingStatus, "APPLIED");
  assert.equal(refundResult.paymentStatus, "REFUNDED");
  assert.equal(refundResult.orderStatus, "REFUNDED");

  const payment = await prisma.commercePayment.findUniqueOrThrow({
    where: {
      provider_providerPaymentId: {
        provider,
        providerPaymentId: failed.paymentId,
      },
    },
  });
  assert.equal(payment.status, "REFUNDED");
  assert.equal(payment.providerOccurredAt?.getTime(), t4.getTime());
  assert.ok(payment.refundedAt instanceof Date);
}

async function scenarioProvisionedRefundSignalsPauseOnly() {
  const order = await createOrder("refund");
  const success = event(order, "refund", "SUCCEEDED", t1);
  await repository.processVerifiedEvent(success);

  await prisma.commerceOrder.update({
    where: { id: order.id },
    data: {
      status: "PROVISIONED",
      provisionedAt: t2,
      version: { increment: 1 },
    },
  });

  const refund = event(order, "refund-event", "REFUNDED", t3, {
    paymentId: success.paymentId,
  });
  const result = await repository.processVerifiedEvent(refund);

  assert.equal(result.processingStatus, "APPLIED");
  assert.equal(result.orderStatus, "REFUNDED");
  assert.equal(result.paymentStatus, "REFUNDED");
  assert.equal(result.shouldPauseProvisionedCase, true);
  assert.equal(result.orderBecamePaid, false);

  const persistedOrder = await prisma.commerceOrder.findUniqueOrThrow({
    where: { id: order.id },
  });
  assert.equal(persistedOrder.status, "REFUNDED");
  assert.equal(persistedOrder.clientCaseId, null);
  assert.ok(persistedOrder.refundedAt instanceof Date);
}

try {
  await scenarioAppliedAndReplay();
  await scenarioConcurrentDuplicate();
  await scenarioRejectedMismatch();
  await scenarioEventIdConflict();
  await scenarioOutOfOrderMonotonicRecovery();
  await scenarioProvisionedRefundSignalsPauseOnly();
  console.log("COMMERCE_POSTGRES_PAYMENT_EVENT_PASS");
} finally {
  await prisma.$disconnect();
}
