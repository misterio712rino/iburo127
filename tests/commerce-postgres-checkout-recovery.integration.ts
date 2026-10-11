import "dotenv/config";

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { getPrismaClient } from "@/server/database/prisma";
import {
  CommerceCheckoutRecoveryService,
  type RecoveredStripeCheckoutSession,
} from "@/server/domain/commerce/checkout-recovery-service";
import { PrismaCommerceCheckoutRecoveryRepository } from "@/server/repositories/prisma/commerce-checkout-recovery-repository";
import { PrismaCommercePaymentEventRepository } from "@/server/repositories/prisma/commerce-payment-event-repository";
import {
  assertIsolatedCiMigrationHistory,
  requireCommercePostgresIntegrationTarget,
} from "./commerce-postgres-integration-target";

const integrationTarget = await requireCommercePostgresIntegrationTarget("COMMERCE_POSTGRES_CHECKOUT_RECOVERY");

const prisma = getPrismaClient();
const recoveryRepository = new PrismaCommerceCheckoutRecoveryRepository();
const paymentRepository = new PrismaCommercePaymentEventRepository();
const runId = randomUUID();
const now = new Date();
const staleStartedAt = new Date(now.getTime() - 21 * 60 * 60 * 1000);
const amountMinor = 1_234_500;
const currency = "RUB";
const orderIds: string[] = [];
const caseIds: string[] = [];
const userIds: string[] = [];
const stageIds: string[] = [];
const planIds: string[] = [];

async function verifyTargetAndMigrations() {
  const identity = await prisma.$queryRaw<Array<{ databaseName: string; databaseUser: string }>>`
    SELECT current_database() AS "databaseName", current_user AS "databaseUser"
  `;
  assert.equal(identity[0]?.databaseName, integrationTarget.expectedDatabaseName);
  assert.equal(identity[0]?.databaseUser, integrationTarget.expectedUser);
  if (integrationTarget.mode === "github-actions-isolated") {
    const appliedMigrations = await prisma.$queryRaw<Array<{
      migrationName: string;
      finishedAt: Date | null;
      rolledBackAt: Date | null;
    }>>`
      SELECT migration_name AS "migrationName", finished_at AS "finishedAt", rolled_back_at AS "rolledBackAt"
      FROM "_prisma_migrations"
    `;
    assertIsolatedCiMigrationHistory(integrationTarget.migrationHistory, appliedMigrations);
  }

  const requiredMigrations = [
    "20261007_commerce_stripe_checkout",
    "20261008_commerce_checkout_session_recovery",
    "20261008_commerce_checkout_session_recovery_audit",
  ];
  const rows = await prisma.$queryRaw<Array<{ migration_name: string }>>`
    SELECT migration_name
    FROM "_prisma_migrations"
    WHERE migration_name IN (
      '20261007_commerce_stripe_checkout',
      '20261008_commerce_checkout_session_recovery',
      '20261008_commerce_checkout_session_recovery_audit'
    )
      AND finished_at IS NOT NULL
      AND rolled_back_at IS NULL
  `;
  assert.deepEqual(new Set(rows.map((row) => row.migration_name)), new Set(requiredMigrations));
}

async function createFixture(label: string) {
  const client = await prisma.user.create({
    data: { email: `checkout-recovery-client-${label}-${runId}@example.test` },
    select: { id: true },
  });
  userIds.push(client.id);

  const operator = await prisma.user.create({
    data: { email: `checkout-recovery-operator-${label}-${runId}@example.test` },
    select: { id: true },
  });
  userIds.push(operator.id);

  const stage = await prisma.caseStage.create({
    data: {
      code: `RECOVERY_${label.toUpperCase()}_${runId.slice(0, 8)}`,
      name: "Checkout recovery integration",
      sortOrder: 9000,
    },
    select: { id: true },
  });
  stageIds.push(stage.id);

  const currentPlan = await prisma.plan.create({
    data: { code: `RECOVERY_OLD_${label.toUpperCase()}_${runId.slice(0, 8)}`, name: "Recovery old test plan" },
    select: { id: true },
  });
  planIds.push(currentPlan.id);

  const targetPlan = await prisma.plan.create({
    data: { code: `RECOVERY_NEW_${label.toUpperCase()}_${runId.slice(0, 8)}`, name: "Recovery target test plan" },
    select: { id: true },
  });
  planIds.push(targetPlan.id);

  const clientCase = await prisma.clientCase.create({
    data: {
      caseNumber: `RECOVERY-${label}-${runId.slice(0, 8)}`,
      clientId: client.id,
      planId: currentPlan.id,
      stageId: stage.id,
    },
    select: { id: true },
  });
  caseIds.push(clientCase.id);

  const order = await prisma.commerceOrder.create({
    data: {
      publicCheckoutId: `chk_${randomUUID().replaceAll("-", "")}`,
      planId: targetPlan.id,
      previousPlanId: currentPlan.id,
      userId: client.id,
      clientCaseId: clientCase.id,
      customerEmail: `checkout-recovery-client-${label}-${runId}@example.test`,
      amountMinor,
      currency,
      offerVersion: "recovery-integration-v1",
      status: "PENDING_PAYMENT",
      stripeCheckoutSessionCreateStartedAt: staleStartedAt,
    },
  });
  orderIds.push(order.id);
  return { clientCaseId: clientCase.id, operatorId: operator.id, order, sessionId: `cs_test_${randomUUID().replaceAll("-", "")}` };
}

function stripeSession(order: {
  id: string;
  publicCheckoutId: string;
  clientCaseId: string | null;
}, sessionId: string): RecoveredStripeCheckoutSession {
  return {
    id: sessionId,
    url: `https://checkout.stripe.com/c/pay/${sessionId}`,
    status: "open",
    mode: "payment",
    clientReferenceId: order.publicCheckoutId,
    metadata: {
      publicCheckoutId: order.publicCheckoutId,
      clientCaseId: order.clientCaseId ?? undefined,
    },
    amountTotal: amountMinor,
    currency: currency.toLowerCase(),
  };
}

async function scenarioAtomicRecoveryThenWebhook(fixture: Awaited<ReturnType<typeof createFixture>>) {
  const service = new CommerceCheckoutRecoveryService(
    recoveryRepository,
    { async retrieveSession() { return stripeSession(fixture.order, fixture.sessionId); } },
  );
  const result = await service.attachExistingOpenSession(
    { userId: fixture.operatorId, roles: ["MANAGER"] },
    {
      publicCheckoutId: fixture.order.publicCheckoutId,
      stripeCheckoutSessionId: fixture.sessionId,
      evidenceReference: `INC-${runId.slice(0, 8).toUpperCase()}`,
    },
  );
  assert.deepEqual(result, { stripeCheckoutSessionId: fixture.sessionId, replayed: false });

  const [order, audit, payments, events] = await Promise.all([
    prisma.commerceOrder.findUniqueOrThrow({ where: { id: fixture.order.id } }),
    prisma.commerceCheckoutSessionRecovery.findUnique({ where: { orderId: fixture.order.id } }),
    prisma.commercePayment.count({ where: { orderId: fixture.order.id } }),
    prisma.commercePaymentEvent.count({ where: { orderId: fixture.order.id } }),
  ]);
  assert.equal(order.stripeCheckoutSessionId, fixture.sessionId);
  assert.equal(order.status, "PENDING_PAYMENT");
  assert.equal(audit?.operatorUserId, fixture.operatorId);
  assert.equal(audit?.stripeCheckoutSessionId, fixture.sessionId);
  assert.match(audit?.evidenceReference ?? "", /^INC-/);
  assert.equal(payments, 0);
  assert.equal(events, 0);

  const webhookResult = await paymentRepository.processVerifiedEvent({
    provider: "stripe",
    eventId: `evt_recovery_${runId}`,
    paymentId: `pi_recovery_${runId}`,
    publicCheckoutId: fixture.order.publicCheckoutId,
    stripeCheckoutSessionId: fixture.sessionId,
    clientCaseId: fixture.clientCaseId,
    kind: "SUCCEEDED",
    amountMinor,
    currency,
    occurredAt: now,
    rawBodySha256: "a".repeat(64),
  });
  assert.equal(webhookResult.processingStatus, "APPLIED");
  assert.equal(webhookResult.orderStatus, "PAID");

  const settled = await prisma.commerceOrder.findUniqueOrThrow({ where: { id: fixture.order.id } });
  assert.equal(settled.stripeCheckoutSessionId, fixture.sessionId);
  assert.equal(settled.status, "PAID");
  assert.equal(
    (await prisma.commerceCheckoutSessionRecovery.findUnique({ where: { orderId: fixture.order.id } }))
      ?.stripeCheckoutSessionId,
    fixture.sessionId,
  );
}

async function scenarioWebhookWinsBeforeRecoveryCommit(fixture: Awaited<ReturnType<typeof createFixture>>) {
  let releaseStripeLookup!: () => void;
  let stripeLookupStarted!: () => void;
  const lookupStarted = new Promise<void>((resolve) => { stripeLookupStarted = resolve; });
  const stripeLookupGate = new Promise<void>((resolve) => { releaseStripeLookup = resolve; });
  const service = new CommerceCheckoutRecoveryService(
    recoveryRepository,
    {
      async retrieveSession() {
        stripeLookupStarted();
        await stripeLookupGate;
        return stripeSession(fixture.order, fixture.sessionId);
      },
    },
  );
  const recoveryPromise = service.attachExistingOpenSession(
    { userId: fixture.operatorId, roles: ["MANAGER"] },
    {
      publicCheckoutId: fixture.order.publicCheckoutId,
      stripeCheckoutSessionId: fixture.sessionId,
      evidenceReference: `INC-${runId.slice(0, 8).toUpperCase()}-RACE`,
    },
  );
  await lookupStarted;

  const eventResult = await paymentRepository.processVerifiedEvent({
    provider: "stripe",
    eventId: `evt_recovery_race_${runId}`,
    paymentId: `pi_recovery_race_${runId}`,
    publicCheckoutId: fixture.order.publicCheckoutId,
    stripeCheckoutSessionId: fixture.sessionId,
    clientCaseId: fixture.clientCaseId,
    kind: "SUCCEEDED",
    amountMinor,
    currency,
    occurredAt: now,
    rawBodySha256: "b".repeat(64),
  });
  releaseStripeLookup();

  await assert.rejects(recoveryPromise, /COMMERCE_CHECKOUT_RECOVERY_NOT_ELIGIBLE|COMMERCE_CHECKOUT_RECOVERY_CONFLICT/);
  assert.equal(eventResult.processingStatus, "APPLIED");
  const [order, audit] = await Promise.all([
    prisma.commerceOrder.findUniqueOrThrow({ where: { id: fixture.order.id } }),
    prisma.commerceCheckoutSessionRecovery.findUnique({ where: { orderId: fixture.order.id } }),
  ]);
  assert.equal(order.status, "PAID");
  assert.equal(order.stripeCheckoutSessionId, fixture.sessionId);
  assert.equal(audit, null, "a webhook-settled order must not receive a recovery audit entry");
}

try {
  await verifyTargetAndMigrations();
  const atomicFixture = await createFixture("atomic");
  await scenarioAtomicRecoveryThenWebhook(atomicFixture);

  const raceFixture = await createFixture("race");
  await scenarioWebhookWinsBeforeRecoveryCommit(raceFixture);
  console.log("COMMERCE_POSTGRES_CHECKOUT_RECOVERY_PASS");
} finally {
  if (orderIds.length) {
    await prisma.commerceCheckoutSessionRecovery.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.commercePaymentEvent.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.commercePayment.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.commerceOrder.deleteMany({ where: { id: { in: orderIds } } });
  }
  if (caseIds.length) await prisma.clientCase.deleteMany({ where: { id: { in: caseIds } } });
  if (userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  if (planIds.length) await prisma.plan.deleteMany({ where: { id: { in: planIds } } });
  if (stageIds.length) await prisma.caseStage.deleteMany({ where: { id: { in: stageIds } } });
  await prisma.$disconnect();
}
