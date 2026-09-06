import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { AuthenticatedActor } from "@/server/domain/client-cases/contracts";
import type {
  ClaimedEmailDelivery,
  CreateNotificationInput,
  NotificationRecord,
  NotificationRepository,
} from "@/server/domain/notifications/contracts";
import {
  NOTIFICATION_INVALID_INPUT,
  NotificationService,
} from "@/server/domain/notifications/service";
import {
  NOTIFICATION_DELIVERY_FAILED,
  NOTIFICATION_DELIVERY_RECIPIENT_UNAVAILABLE,
  NotificationDeliveryWorker,
  notificationDeliveryRetryDelayMs,
} from "@/server/notifications/delivery-worker";
import type { TransactionalEmailDelivery } from "@/server/email/yandex-postbox-core";

const baseRecord: NotificationRecord = {
  id: "11111111-1111-4111-8111-111111111111",
  userId: "22222222-2222-4222-8222-222222222222",
  clientCaseId: null,
  dedupeKey: null,
  type: "task.assigned",
  title: "Task assigned",
  body: "A new task is available.",
  readAt: null,
  createdAt: new Date("2026-08-28T18:00:00.000Z"),
};

function createRepository(
  overrides: Partial<NotificationRepository> = {},
): NotificationRepository {
  return {
    async listForUser() {
      return [];
    },
    async markRead() {
      return baseRecord;
    },
    async markAllRead() {
      return 0;
    },
    async create() {
      return baseRecord;
    },
    async claimDueEmailDelivery() {
      return null;
    },
    async markEmailDeliverySent() {
      return true;
    },
    async rescheduleEmailDelivery() {
      return true;
    },
    async markEmailDeliveryDead() {
      return true;
    },
    ...overrides,
  };
}

let capturedCreate: CreateNotificationInput | undefined;
const service = new NotificationService(
  createRepository({
    async create(input) {
      capturedCreate = input;
      return { ...baseRecord, dedupeKey: input.dedupeKey ?? null };
    },
  }),
);

assert.throws(
  () =>
    service.createSystem({
      userId: baseRecord.userId,
      type: "task.assigned",
      title: "Task assigned",
      body: "A new task is available.",
      deliveryChannels: ["EMAIL"],
    }),
  new RegExp(NOTIFICATION_INVALID_INPUT),
);

await service.createSystem({
  userId: ` ${baseRecord.userId} `,
  dedupeKey: " task:abc:assigned ",
  type: "task.assigned",
  title: " Task assigned ",
  body: " A new task is available. ",
  deliveryChannels: ["EMAIL", "EMAIL"],
});
assert.deepEqual(capturedCreate, {
  userId: baseRecord.userId,
  clientCaseId: null,
  dedupeKey: "task:abc:assigned",
  type: "task.assigned",
  title: "Task assigned",
  body: "A new task is available.",
  deliveryChannels: ["EMAIL"],
});

{
  let capturedUserId = "";
  const readService = new NotificationService(
    createRepository({
      async markAllRead(userId) {
        capturedUserId = userId;
        return 7;
      },
    }),
  );
  const result = await readService.markAllRead({ userId: baseRecord.userId } as AuthenticatedActor);
  assert.equal(capturedUserId, baseRecord.userId);
  assert.deepEqual(result, { updatedCount: 7 });
}

assert.equal(notificationDeliveryRetryDelayMs(1), 60_000);
assert.equal(notificationDeliveryRetryDelayMs(2), 5 * 60_000);
assert.equal(notificationDeliveryRetryDelayMs(3), 15 * 60_000);
assert.equal(notificationDeliveryRetryDelayMs(4), 60 * 60_000);
assert.equal(notificationDeliveryRetryDelayMs(5), 6 * 60 * 60_000);
assert.equal(notificationDeliveryRetryDelayMs(99), 6 * 60 * 60_000);

const now = new Date("2026-08-28T18:30:00.000Z");
const claimedBase: ClaimedEmailDelivery = {
  id: "33333333-3333-4333-8333-333333333333",
  notificationId: baseRecord.id,
  leaseToken: "44444444-4444-4444-8444-444444444444",
  attemptCount: 1,
  recipientEmail: "recipient@example.com",
  title: "Task assigned",
  body: "A new task is available.",
};

{
  const claims: Array<ClaimedEmailDelivery | null> = [claimedBase, null];
  const sentMarks: string[] = [];
  const sentRecipients: string[] = [];
  const repository = createRepository({
    async claimDueEmailDelivery() {
      return claims.shift() ?? null;
    },
    async markEmailDeliverySent(input) {
      sentMarks.push(input.deliveryId);
      return true;
    },
  });
  const email: TransactionalEmailDelivery = {
    async send(input) {
      sentRecipients.push(input.to);
    },
  };
  const result = await new NotificationDeliveryWorker(repository, email, () => now).processBatch({
    limit: 10,
    leaseMs: 120_000,
    maxAttempts: 6,
  });
  assert.deepEqual(result, {
    inspected: 1,
    sent: 1,
    retryScheduled: 0,
    dead: 0,
    leaseLost: 0,
  });
  assert.deepEqual(sentRecipients, ["recipient@example.com"]);
  assert.deepEqual(sentMarks, [claimedBase.id]);
}

{
  const claims: Array<ClaimedEmailDelivery | null> = [claimedBase, null];
  let retryAt: Date | undefined;
  let retryError = "";
  const repository = createRepository({
    async claimDueEmailDelivery() {
      return claims.shift() ?? null;
    },
    async rescheduleEmailDelivery(input) {
      retryAt = input.nextAttemptAt;
      retryError = input.errorCode;
      return true;
    },
  });
  const email: TransactionalEmailDelivery = {
    async send() {
      throw new Error("EMAIL_DELIVERY_FAILED:NETWORK");
    },
  };
  const result = await new NotificationDeliveryWorker(repository, email, () => now).processBatch({
    limit: 10,
    leaseMs: 120_000,
    maxAttempts: 6,
  });
  assert.equal(result.retryScheduled, 1);
  assert.equal(retryAt?.toISOString(), new Date(now.getTime() + 60_000).toISOString());
  assert.equal(retryError, "EMAIL_DELIVERY_FAILED:NETWORK");
}

{
  const claims: Array<ClaimedEmailDelivery | null> = [
    { ...claimedBase, attemptCount: 6 },
    null,
  ];
  let deadError = "";
  const repository = createRepository({
    async claimDueEmailDelivery() {
      return claims.shift() ?? null;
    },
    async markEmailDeliveryDead(input) {
      deadError = input.errorCode;
      return true;
    },
  });
  const email: TransactionalEmailDelivery = {
    async send() {
      throw new Error("raw provider details must not persist");
    },
  };
  const result = await new NotificationDeliveryWorker(repository, email, () => now).processBatch({
    limit: 10,
    leaseMs: 120_000,
    maxAttempts: 6,
  });
  assert.equal(result.dead, 1);
  assert.equal(deadError, NOTIFICATION_DELIVERY_FAILED);
}

{
  const claims: Array<ClaimedEmailDelivery | null> = [
    { ...claimedBase, recipientEmail: null },
    null,
  ];
  let deadError = "";
  let sendCount = 0;
  const repository = createRepository({
    async claimDueEmailDelivery() {
      return claims.shift() ?? null;
    },
    async markEmailDeliveryDead(input) {
      deadError = input.errorCode;
      return true;
    },
  });
  const email: TransactionalEmailDelivery = {
    async send() {
      sendCount += 1;
    },
  };
  const result = await new NotificationDeliveryWorker(repository, email, () => now).processBatch({
    limit: 10,
    leaseMs: 120_000,
    maxAttempts: 6,
  });
  assert.equal(result.dead, 1);
  assert.equal(sendCount, 0);
  assert.equal(deadError, NOTIFICATION_DELIVERY_RECIPIENT_UNAVAILABLE);
}

{
  const buttonSource = await readFile(
    resolve("components/platform/notifications/MarkAllNotificationsReadButton.tsx"),
    "utf8",
  );
  const pageSource = await readFile(resolve("app/portal/notifications/page.tsx"), "utf8");
  const routeSource = await readFile(
    resolve("app/api/platform/notifications/read-all/route.ts"),
    "utf8",
  );
  const repositorySource = await readFile(
    resolve("server/repositories/prisma/notification-repository.ts"),
    "utf8",
  );
  const serviceSource = await readFile(resolve("server/domain/notifications/service.ts"), "utf8");

  assert.match(buttonSource, /Отметить все прочитанными/);
  assert.match(
    buttonSource,
    /fetch\("\/api\/platform\/notifications\/read-all",\s*\{[\s\S]*?method: "POST"/,
  );
  assert.match(buttonSource, /min-h-11/);
  assert.doesNotMatch(buttonSource, /userId/);
  assert.match(
    pageSource,
    /\{unreadCount \? <MarkAllNotificationsReadButton \/> : null\}/,
  );
  assert.match(
    routeSource,
    /export async function POST\(\) \{\s*return adapter\(\)\.markAllRead\(\);\s*\}/,
  );
  assert.match(
    serviceSource,
    /markAllRead\(actor: AuthenticatedActor\)[\s\S]*?repository\.markAllRead\(actor\.userId\)/,
  );
  assert.match(
    repositorySource,
    /async markAllRead\(userId: string\)[\s\S]*?where: \{ userId, readAt: null \}[\s\S]*?data: \{ readAt: new Date\(\) \}/,
  );
  console.log("NOTIFICATION_BULK_READ_CONTRACT_PASS");
}

console.log("NOTIFICATION_OUTBOX_DOMAIN_TEST_PASS");
