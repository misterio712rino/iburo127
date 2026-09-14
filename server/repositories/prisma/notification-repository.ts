import "server-only";

import { randomUUID } from "node:crypto";
import { getPrismaClient } from "@/server/database/prisma";
import {
  NOTIFICATION_DEDUPE_CONFLICT,
  NOTIFICATION_NOT_FOUND,
  type CreateNotificationInput,
  type NotificationRecord,
  type NotificationRepository,
} from "@/server/domain/notifications/contracts";
import { buildCaseActivityWrite } from "@/server/repositories/prisma/case-activity-write";

function toRecord(row: NotificationRecord): NotificationRecord {
  return row;
}

function normalizedChannels(input: CreateNotificationInput) {
  return [...new Set(input.deliveryChannels ?? [])].sort();
}

function assertDedupeMatch(
  existing: NotificationRecord & { deliveries: Array<{ channel: string }> },
  input: CreateNotificationInput,
) {
  const existingChannels = existing.deliveries.map((delivery) => delivery.channel).sort();
  const requestedChannels = normalizedChannels(input);
  const same =
    existing.userId === input.userId &&
    existing.clientCaseId === (input.clientCaseId ?? null) &&
    existing.dedupeKey === (input.dedupeKey ?? null) &&
    existing.type === input.type &&
    existing.title === input.title &&
    existing.body === input.body &&
    existingChannels.length === requestedChannels.length &&
    existingChannels.every((channel, index) => channel === requestedChannels[index]);

  if (!same) throw new Error(NOTIFICATION_DEDUPE_CONFLICT);
}

export class PrismaNotificationRepository implements NotificationRepository {
  async listForUser(userId: string, limit: number) {
    const prisma = getPrismaClient();
    const rows = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return rows.map(toRecord);
  }

  async markRead(userId: string, notificationId: string) {
    const prisma = getPrismaClient();
    const updated = await prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { readAt: new Date() },
    });
    if (updated.count !== 1) throw new Error(NOTIFICATION_NOT_FOUND);

    const row = await prisma.notification.findUnique({ where: { id: notificationId } });
    if (!row || row.userId !== userId) throw new Error(NOTIFICATION_NOT_FOUND);
    return toRecord(row);
  }

  async markAllRead(userId: string) {
    const prisma = getPrismaClient();
    const updated = await prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return updated.count;
  }

  async create(input: CreateNotificationInput) {
    const prisma = getPrismaClient();
    const deliveryChannels = normalizedChannels(input);
    const dedupeKey = input.dedupeKey ?? null;

    if (deliveryChannels.length > 0 && !dedupeKey) {
      throw new Error(NOTIFICATION_DEDUPE_CONFLICT);
    }

    return prisma.$transaction(async (tx) => {
      if (dedupeKey) {
        const existing = await tx.notification.findUnique({
          where: {
            userId_dedupeKey: {
              userId: input.userId,
              dedupeKey,
            },
          },
          include: {
            deliveries: {
              select: { channel: true },
            },
          },
        });
        if (existing) {
          assertDedupeMatch(existing, input);
          return toRecord(existing);
        }
      }

      const notificationId = randomUUID();
      if (dedupeKey) {
        const inserted = await tx.notification.createMany({
          data: [
            {
              id: notificationId,
              userId: input.userId,
              clientCaseId: input.clientCaseId ?? null,
              dedupeKey,
              type: input.type,
              title: input.title,
              body: input.body,
            },
          ],
          skipDuplicates: true,
        });

        if (inserted.count === 0) {
          const raced = await tx.notification.findUnique({
            where: {
              userId_dedupeKey: {
                userId: input.userId,
                dedupeKey,
              },
            },
            include: {
              deliveries: {
                select: { channel: true },
              },
            },
          });
          if (!raced) throw new Error(NOTIFICATION_DEDUPE_CONFLICT);
          assertDedupeMatch(raced, input);
          return toRecord(raced);
        }
      } else {
        await tx.notification.create({
          data: {
            id: notificationId,
            userId: input.userId,
            clientCaseId: input.clientCaseId ?? null,
            dedupeKey: null,
            type: input.type,
            title: input.title,
            body: input.body,
          },
        });
      }

      if (deliveryChannels.length > 0) {
        await tx.notificationDelivery.createMany({
          data: deliveryChannels.map((channel) => ({
            notificationId,
            channel,
          })),
        });
      }

      if (input.clientCaseId) {
        await tx.caseActivityEvent.create({
          data: buildCaseActivityWrite({
            clientCaseId: input.clientCaseId,
            actorUserId: null,
            type: "notification.created",
            metadata: {
              notificationId,
              notificationType: input.type,
            },
          }),
        });
      }

      const row = await tx.notification.findUnique({ where: { id: notificationId } });
      if (!row) throw new Error(NOTIFICATION_NOT_FOUND);
      return toRecord(row);
    });
  }

  async claimDueEmailDelivery(input: { now: Date; leaseUntil: Date }) {
    const prisma = getPrismaClient();
    const eligible = {
      OR: [
        {
          status: "PENDING" as const,
          nextAttemptAt: { lte: input.now },
        },
        {
          status: "PROCESSING" as const,
          leaseUntil: { lte: input.now },
        },
      ],
    };

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = await prisma.notificationDelivery.findFirst({
        where: {
          channel: "EMAIL",
          ...eligible,
        },
        orderBy: [{ nextAttemptAt: "asc" }, { createdAt: "asc" }],
        select: { id: true },
      });
      if (!candidate) return null;

      const leaseToken = randomUUID();
      const claimed = await prisma.notificationDelivery.updateMany({
        where: {
          id: candidate.id,
          channel: "EMAIL",
          ...eligible,
        },
        data: {
          status: "PROCESSING",
          leaseUntil: input.leaseUntil,
          leaseToken,
          attemptCount: { increment: 1 },
        },
      });
      if (claimed.count !== 1) continue;

      const row = await prisma.notificationDelivery.findUnique({
        where: { id: candidate.id },
        include: {
          notification: {
            select: {
              title: true,
              body: true,
              user: {
                select: { email: true },
              },
            },
          },
        },
      });
      if (!row || row.status !== "PROCESSING" || row.leaseToken !== leaseToken) continue;

      return {
        id: row.id,
        notificationId: row.notificationId,
        leaseToken,
        attemptCount: row.attemptCount,
        recipientEmail: row.notification.user.email,
        title: row.notification.title,
        body: row.notification.body,
      };
    }

    return null;
  }

  async markEmailDeliverySent(input: {
    deliveryId: string;
    leaseToken: string;
    sentAt: Date;
    providerMessageId?: string | null;
  }) {
    const prisma = getPrismaClient();
    const updated = await prisma.notificationDelivery.updateMany({
      where: {
        id: input.deliveryId,
        status: "PROCESSING",
        leaseToken: input.leaseToken,
      },
      data: {
        status: "SENT",
        sentAt: input.sentAt,
        providerMessageId: input.providerMessageId ?? null,
        lastErrorCode: null,
        leaseUntil: null,
        leaseToken: null,
      },
    });
    return updated.count === 1;
  }

  async rescheduleEmailDelivery(input: {
    deliveryId: string;
    leaseToken: string;
    nextAttemptAt: Date;
    errorCode: string;
  }) {
    const prisma = getPrismaClient();
    const updated = await prisma.notificationDelivery.updateMany({
      where: {
        id: input.deliveryId,
        status: "PROCESSING",
        leaseToken: input.leaseToken,
      },
      data: {
        status: "PENDING",
        nextAttemptAt: input.nextAttemptAt,
        lastErrorCode: input.errorCode,
        leaseUntil: null,
        leaseToken: null,
      },
    });
    return updated.count === 1;
  }

  async markEmailDeliveryDead(input: {
    deliveryId: string;
    leaseToken: string;
    errorCode: string;
  }) {
    const prisma = getPrismaClient();
    const updated = await prisma.notificationDelivery.updateMany({
      where: {
        id: input.deliveryId,
        status: "PROCESSING",
        leaseToken: input.leaseToken,
      },
      data: {
        status: "DEAD",
        lastErrorCode: input.errorCode,
        leaseUntil: null,
        leaseToken: null,
      },
    });
    return updated.count === 1;
  }
}
