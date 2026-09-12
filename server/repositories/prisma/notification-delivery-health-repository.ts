import "server-only";

import { getPrismaClient } from "@/server/database/prisma";
import type {
  NotificationDeliveryHealthRepository,
  NotificationDeliveryHealthSnapshot,
} from "@/server/domain/notifications/delivery-health";

function boundedCount(length: number, limit: number) {
  return Math.min(length, limit);
}

export class PrismaNotificationDeliveryHealthRepository
  implements NotificationDeliveryHealthRepository
{
  async inspect(input: {
    overdueBefore: Date;
    limit: number;
  }): Promise<NotificationDeliveryHealthSnapshot> {
    const prisma = getPrismaClient();
    const take = input.limit + 1;

    const [overduePendingRows, expiredLeaseRows, deadRows] = await Promise.all([
      prisma.notificationDelivery.findMany({
        where: {
          channel: "EMAIL",
          status: "PENDING",
          nextAttemptAt: { lte: input.overdueBefore },
        },
        select: { id: true },
        orderBy: [{ nextAttemptAt: "asc" }, { id: "asc" }],
        take,
      }),
      prisma.notificationDelivery.findMany({
        where: {
          channel: "EMAIL",
          status: "PROCESSING",
          leaseUntil: { lte: input.overdueBefore },
        },
        select: { id: true },
        orderBy: [{ leaseUntil: "asc" }, { id: "asc" }],
        take,
      }),
      prisma.notificationDelivery.findMany({
        where: {
          channel: "EMAIL",
          status: "DEAD",
        },
        select: { id: true },
        orderBy: { id: "asc" },
        take,
      }),
    ]);

    return {
      overduePending: boundedCount(overduePendingRows.length, input.limit),
      expiredLeases: boundedCount(expiredLeaseRows.length, input.limit),
      dead: boundedCount(deadRows.length, input.limit),
      saturated:
        overduePendingRows.length > input.limit ||
        expiredLeaseRows.length > input.limit ||
        deadRows.length > input.limit,
    };
  }
}
