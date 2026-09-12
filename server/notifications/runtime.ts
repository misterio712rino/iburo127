import "server-only";

import { NotificationService } from "@/server/domain/notifications/service";
import { PrismaNotificationRepository } from "@/server/repositories/prisma/notification-repository";

export const notificationService = new NotificationService(
  new PrismaNotificationRepository(),
);
