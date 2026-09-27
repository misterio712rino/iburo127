import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { getPrismaClient } from "@/server/database/prisma";
import {
  COMMERCE_INVALID_INPUT,
  COMMERCE_PLAN_UNAVAILABLE,
  COMMERCE_UNSUPPORTED_PLAN,
  type CommercePricingCatalog,
} from "@/server/domain/commerce/contracts";
import { PrismaCommerceOrderRepository } from "@/server/repositories/prisma/commerce-order-repository";

const prisma = getPrismaClient();
const repository = new PrismaCommerceOrderRepository();
const runId = randomUUID();

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
  const litePlan = await prisma.plan.upsert({
    where: { code: "LITE" },
    update: { name: "Лайт", isActive: true },
    create: { code: "LITE", name: "Лайт", isActive: true },
  });
  await prisma.plan.upsert({
    where: { code: "PRO" },
    update: { name: "Про", isActive: false },
    create: { code: "PRO", name: "Про", isActive: false },
  });

  const created = await repository.createPendingOrder({
    planCode: "LITE",
    customerEmail: `  Customer-${runId}@Example.TEST  `,
    catalog,
  });

  assert.equal(created.planCode, "LITE");
  assert.equal(created.amountMinor, 799_000);
  assert.equal(created.currency, "RUB");
  assert.equal(created.offerVersion, "offer-test-2026-09-27");
  assert.equal(created.status, "PENDING_PAYMENT");
  assert.match(created.publicCheckoutId, /^chk_[A-Za-z0-9_-]{32}$/);

  const persisted = await prisma.commerceOrder.findUniqueOrThrow({
    where: { publicCheckoutId: created.publicCheckoutId },
  });
  assert.equal(persisted.planId, litePlan.id);
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

  const second = await repository.createPendingOrder({
    planCode: "LITE",
    customerEmail: `second-${runId}@example.test`,
    catalog,
  });
  assert.notEqual(second.publicCheckoutId, created.publicCheckoutId);

  await assert.rejects(
    repository.createPendingOrder({
      planCode: "PRO",
      customerEmail: `pro-${runId}@example.test`,
      catalog,
    }),
    new RegExp(COMMERCE_PLAN_UNAVAILABLE),
  );

  await assert.rejects(
    repository.createPendingOrder({
      planCode: "INDIVIDUAL",
      customerEmail: `individual-${runId}@example.test`,
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
  assert.equal(orderCount, 2);

  console.log("COMMERCE_POSTGRES_ORDER_CREATION_PASS");
} finally {
  await prisma.$disconnect();
}
