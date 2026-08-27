import "server-only";

import { getPrismaClient } from "@/server/database/prisma";
import {
  NOTIFICATION_NOT_FOUND,
  type NotificationRecord,
  type NotificationRepository,
} from "@/server/domain/notifications/contracts";

function toRecord(row: NotificationRecord): NotificationRecord {
  return row;
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

  async create(input: {
    userId: string;
    clientCaseId?: string | null;
    type: string;
    title: string;
    body: string;
  }) {
    const prisma = getPrismaClient();
    const row = await prisma.notification.create({
      data: {
        userId: input.userId,
        clientCaseId: input.clientCaseId ?? null,
        type: input.type,
        title: input.title,
        body: input.body,
      },
    });
    return toRecord(row);
  }
}
