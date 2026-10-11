import "dotenv/config";

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { getPrismaClient } from "@/server/database/prisma";
import {
  COMMERCE_CASE_CHECKOUT_PENDING,
  COMMERCE_CHECKOUT_IDEMPOTENCY_CONFLICT,
  COMMERCE_INVALID_INPUT,
  COMMERCE_PLAN_UNAVAILABLE,
  COMMERCE_UNSUPPORTED_PLAN,
  type CommercePricingCatalog,
} from "@/server/domain/commerce/contracts";
import { PrismaCommerceCaseCheckoutRepository } from "@/server/repositories/prisma/commerce-case-checkout-repository";
import { PrismaCommerceOrderRepository } from "@/server/repositories/prisma/commerce-order-repository";
import {
  assertIsolatedCiMigrationHistory,
  requireCommercePostgresIntegrationTarget,
} from "./commerce-postgres-integration-target";

const integrationTarget = await requireCommercePostgresIntegrationTarget("COMMERCE_POSTGRES_ORDER_CREATION");

const prisma = getPrismaClient();
const repository = new PrismaCommerceOrderRepository();
const caseCheckoutRepository = new PrismaCommerceCaseCheckoutRepository();
const runId = randomUUID();
let checkoutCaseId: string | null = null;
let checkoutUserId: string | null = null;
let checkoutStageId: string | null = null;
let priorLitePlan: { id: string; name: string; description: string | null; isActive: boolean } | null = null;
let priorProPlan: { id: string; name: string; description: string | null; isActive: boolean } | null = null;
let testProPlanId: string | null = null;

const catalog: CommercePricingCatalog = {
  LITE: {
    planCode: "LITE",
    amountMinor: 799_000,
    currency: "rub",
    offerVersion: "offer-test-2026-09-27",
    active: true,
  },
  PRO: {
    planCode: "PRO",
    amountMinor: 2_999_000,
    currency: "RUB",
    offerVersion: "offer-test-2026-09-27",
    active: true,
  },
};

try {
  const targetIdentity = await prisma.$queryRaw<Array<{ databaseName: string; databaseUser: string }>>`
    SELECT current_database() AS "databaseName", current_user AS "databaseUser"
  `;
  assert.equal(targetIdentity[0]?.databaseName, integrationTarget.expectedDatabaseName);
  assert.equal(targetIdentity[0]?.databaseUser, integrationTarget.expectedUser);
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
  const stripeMigration = await prisma.$queryRaw<Array<{ applied: boolean }>>`
    SELECT EXISTS (
      SELECT 1
      FROM "_prisma_migrations"
      WHERE migration_name = '20261007_commerce_stripe_checkout'
        AND finished_at IS NOT NULL
        AND rolled_back_at IS NULL
    ) AS applied
  `;
  assert.equal(stripeMigration[0]?.applied, true, "the staging Stripe migration must already be applied");

  [priorLitePlan, priorProPlan] = await Promise.all([
    prisma.plan.findUnique({ where: { code: "LITE" }, select: { id: true, name: true, description: true, isActive: true } }),
    prisma.plan.findUnique({ where: { code: "PRO" }, select: { id: true, name: true, description: true, isActive: true } }),
  ]);

  const litePlan = await prisma.plan.upsert({
    where: { code: "LITE" },
    update: { name: "Лайт", isActive: true },
    create: { code: "LITE", name: "Лайт", isActive: true },
  });
  const proPlan = await prisma.plan.upsert({
    where: { code: "PRO" },
    update: { name: "Про", isActive: false },
    create: { code: "PRO", name: "Про", isActive: false },
  });
  testProPlanId = proPlan.id;

  const firstRequestId = randomUUID();
  const created = await repository.createPendingOrder({
    planCode: "LITE",
    customerEmail: `  Customer-${runId}@Example.TEST  `,
    checkoutRequestId: firstRequestId,
    catalog,
  });

  assert.equal(created.planCode, "LITE");
  assert.equal(created.amountMinor, 799_000);
  assert.equal(created.currency, "RUB");
  assert.equal(created.offerVersion, "offer-test-2026-09-27");
  assert.equal(created.status, "PENDING_PAYMENT");
  assert.equal(created.replayed, false);
  assert.match(created.publicCheckoutId, /^chk_[A-Za-z0-9_-]{32}$/);

  const persisted = await prisma.commerceOrder.findUniqueOrThrow({
    where: { publicCheckoutId: created.publicCheckoutId },
  });
  assert.equal(persisted.planId, litePlan.id);
  assert.equal(persisted.checkoutRequestId, firstRequestId);
  assert.equal(
    persisted.customerEmail,
    `customer-${runId}@example.test`,
  );
  assert.equal(persisted.amountMinor, 799_000);
  assert.equal(persisted.currency, "RUB");
  assert.equal(persisted.offerVersion, "offer-test-2026-09-27");
  assert.equal(persisted.status, "PENDING_PAYMENT");
  assert.equal(persisted.userId, null);
  assert.equal(persisted.clientCaseId, null);
  assert.equal(persisted.paidAt, null);
  assert.equal(persisted.provisionedAt, null);

  const replay = await repository.createPendingOrder({
    planCode: "LITE",
    customerEmail: `customer-${runId}@example.test`,
    checkoutRequestId: firstRequestId,
    catalog,
  });
  assert.equal(replay.publicCheckoutId, created.publicCheckoutId);
  assert.equal(replay.replayed, true);

  await assert.rejects(
    repository.createPendingOrder({
      planCode: "LITE",
      customerEmail: `different-${runId}@example.test`,
      checkoutRequestId: firstRequestId,
      catalog,
    }),
    new RegExp(COMMERCE_CHECKOUT_IDEMPOTENCY_CONFLICT),
  );

  await assert.rejects(
    repository.createPendingOrder({
      planCode: "LITE",
      customerEmail: `customer-${runId}@example.test`,
      checkoutRequestId: firstRequestId,
      catalog: {
        ...catalog,
        LITE: {
          ...catalog.LITE!,
          amountMinor: 799_001,
        },
      },
    }),
    new RegExp(COMMERCE_CHECKOUT_IDEMPOTENCY_CONFLICT),
  );

  const concurrentRequestId = randomUUID();
  const concurrent = await Promise.all([
    repository.createPendingOrder({
      planCode: "LITE",
      customerEmail: `concurrent-${runId}@example.test`,
      checkoutRequestId: concurrentRequestId,
      catalog,
    }),
    repository.createPendingOrder({
      planCode: "LITE",
      customerEmail: `concurrent-${runId}@example.test`,
      checkoutRequestId: concurrentRequestId,
      catalog,
    }),
  ]);
  assert.equal(concurrent[0].publicCheckoutId, concurrent[1].publicCheckoutId);
  assert.equal(concurrent.filter((item) => item.replayed).length, 1);

  const conflictingRaceRequestId = randomUUID();
  const conflictingRace = await Promise.allSettled([
    repository.createPendingOrder({
      planCode: "LITE",
      customerEmail: `race-a-${runId}@example.test`,
      checkoutRequestId: conflictingRaceRequestId,
      catalog,
    }),
    repository.createPendingOrder({
      planCode: "LITE",
      customerEmail: `race-b-${runId}@example.test`,
      checkoutRequestId: conflictingRaceRequestId,
      catalog,
    }),
  ]);
  const conflictingRaceFulfilled = conflictingRace.filter(
    (item): item is PromiseFulfilledResult<Awaited<ReturnType<PrismaCommerceOrderRepository["createPendingOrder"]>>> =>
      item.status === "fulfilled",
  );
  const conflictingRaceRejected = conflictingRace.filter(
    (item): item is PromiseRejectedResult => item.status === "rejected",
  );
  assert.equal(conflictingRaceFulfilled.length, 1);
  assert.equal(conflictingRaceRejected.length, 1);
  assert.match(
    conflictingRaceRejected[0].reason instanceof Error
      ? conflictingRaceRejected[0].reason.message
      : String(conflictingRaceRejected[0].reason),
    new RegExp(COMMERCE_CHECKOUT_IDEMPOTENCY_CONFLICT),
  );
  assert.equal(
    await prisma.commerceOrder.count({
      where: { checkoutRequestId: conflictingRaceRequestId },
    }),
    1,
  );

  const second = await repository.createPendingOrder({
    planCode: "LITE",
    customerEmail: `second-${runId}@example.test`,
    checkoutRequestId: randomUUID(),
    catalog,
  });
  assert.notEqual(second.publicCheckoutId, created.publicCheckoutId);

  await assert.rejects(
    repository.createPendingOrder({
      planCode: "PRO",
      customerEmail: `pro-${runId}@example.test`,
      checkoutRequestId: randomUUID(),
      catalog,
    }),
    new RegExp(COMMERCE_PLAN_UNAVAILABLE),
  );

  await assert.rejects(
    repository.createPendingOrder({
      planCode: "INDIVIDUAL",
      customerEmail: `individual-${runId}@example.test`,
      checkoutRequestId: randomUUID(),
      catalog,
    }),
    new RegExp(COMMERCE_UNSUPPORTED_PLAN),
  );

  for (const invalidEmail of [
    "",
    "not-an-email",
    "a".repeat(65) + "@example.test",
    "user@example",
    "user\n@example.test",
  ]) {
    await assert.rejects(
      repository.createPendingOrder({
        planCode: "LITE",
        customerEmail: invalidEmail,
        checkoutRequestId: randomUUID(),
        catalog,
      }),
      new RegExp(COMMERCE_INVALID_INPUT),
    );
  }


  for (const invalidRequestId of [
    "",
    "not-a-uuid",
    "00000000-0000-0000-0000-000000000000",
    "550e8400-e29b-11d4-a716-446655440000",
  ]) {
    await assert.rejects(
      repository.createPendingOrder({
        planCode: "LITE",
        customerEmail: `request-id-${runId}@example.test`,
        checkoutRequestId: invalidRequestId,
        catalog,
      }),
      new RegExp(COMMERCE_INVALID_INPUT),
    );
  }

  const orderCount = await prisma.commerceOrder.count({
    where: {
      customerEmail: {
        contains: runId,
      },
    },
  });
  assert.equal(orderCount, 4);

  const client = await prisma.user.create({
    data: { email: `case-checkout-${runId}@example.test`, displayName: "Checkout integration fixture" },
    select: { id: true },
  });
  checkoutUserId = client.id;
  const stage = await prisma.caseStage.create({
    data: { code: `checkout-test-${runId}`, name: "Checkout integration fixture", sortOrder: 999 },
    select: { id: true },
  });
  checkoutStageId = stage.id;
  const clientCase = await prisma.clientCase.create({
    data: {
      caseNumber: `CHECKOUT-${runId.slice(0, 8)}`,
      clientId: client.id,
      planId: litePlan.id,
      stageId: stage.id,
    },
    select: { id: true },
  });
  checkoutCaseId = clientCase.id;
  assert.ok(testProPlanId);
  await prisma.plan.update({ where: { id: testProPlanId }, data: { isActive: true } });

  const distinctRequests = await Promise.allSettled([
    caseCheckoutRepository.createPendingOrder({
      userId: client.id,
      clientCaseId: clientCase.id,
      checkoutRequestId: randomUUID(),
      planCode: "PRO",
      catalog,
    }),
    caseCheckoutRepository.createPendingOrder({
      userId: client.id,
      clientCaseId: clientCase.id,
      checkoutRequestId: randomUUID(),
      planCode: "PRO",
      catalog,
    }),
  ]);
  const accepted = distinctRequests.filter(
    (item): item is PromiseFulfilledResult<Awaited<ReturnType<typeof caseCheckoutRepository.createPendingOrder>>> =>
      item.status === "fulfilled",
  );
  const rejected = distinctRequests.filter((item): item is PromiseRejectedResult => item.status === "rejected");
  assert.equal(accepted.length, 1);
  assert.equal(rejected.length, 1);
  assert.match(
    rejected[0].reason instanceof Error ? rejected[0].reason.message : String(rejected[0].reason),
    new RegExp(COMMERCE_CASE_CHECKOUT_PENDING),
  );
  assert.equal(accepted[0].value.status, "PENDING_PAYMENT");
  assert.equal(
    await prisma.commerceOrder.count({
      where: { clientCaseId: clientCase.id, status: "PENDING_PAYMENT" },
    }),
    1,
  );

  console.log("COMMERCE_POSTGRES_ORDER_CREATION_PASS");
} finally {
  if (checkoutCaseId) {
    await prisma.commerceOrder.deleteMany({ where: { clientCaseId: checkoutCaseId } });
    await prisma.clientCase.deleteMany({ where: { id: checkoutCaseId } });
  }
  if (checkoutUserId) await prisma.user.deleteMany({ where: { id: checkoutUserId } });
  if (checkoutStageId) await prisma.caseStage.deleteMany({ where: { id: checkoutStageId } });
  await prisma.commerceOrder.deleteMany({ where: { customerEmail: { contains: runId } } });
  if (priorLitePlan) {
    await prisma.plan.update({
      where: { id: priorLitePlan.id },
      data: { name: priorLitePlan.name, description: priorLitePlan.description, isActive: priorLitePlan.isActive },
    });
  }
  if (priorProPlan) {
    await prisma.plan.update({
      where: { id: priorProPlan.id },
      data: { name: priorProPlan.name, description: priorProPlan.description, isActive: priorProPlan.isActive },
    });
  } else if (testProPlanId) {
    await prisma.plan.update({ where: { id: testProPlanId }, data: { isActive: false } });
  }
  await prisma.$disconnect();
}
