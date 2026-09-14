import "server-only";

import { NotificationDeliveryHealthService } from "@/server/domain/notifications/delivery-health";
import { PrismaNotificationDeliveryHealthRepository } from "@/server/repositories/prisma/notification-delivery-health-repository";

let singleton: NotificationDeliveryHealthService | null = null;

export function getNotificationDeliveryHealthService() {
  if (singleton) return singleton;
  singleton = new NotificationDeliveryHealthService(
    new PrismaNotificationDeliveryHealthRepository(),
  );
  return singleton;
}
