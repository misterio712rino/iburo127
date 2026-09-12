import "server-only";

import { getTransactionalEmailDelivery } from "@/server/email/runtime";
import { NotificationDeliveryWorker } from "@/server/notifications/delivery-worker";
import { PrismaNotificationRepository } from "@/server/repositories/prisma/notification-repository";

export function getNotificationDeliveryWorker() {
  return new NotificationDeliveryWorker(
    new PrismaNotificationRepository(),
    getTransactionalEmailDelivery(),
  );
}
