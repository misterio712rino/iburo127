import "server-only";

import type { SessionProvider } from "@/server/auth/contracts";
import {
  handleListNotifications,
  handleMarkAllNotificationsRead,
  handleMarkNotificationRead,
} from "@/server/notifications/handlers";
import { toNotificationHttpResponse } from "@/server/notifications/http";

export function createNotificationRouteAdapter(sessionProvider: SessionProvider) {
  return {
    async list(limit?: unknown): Promise<Response> {
      return toNotificationHttpResponse(
        await handleListNotifications(sessionProvider, limit),
      );
    },

    async markRead(notificationId: unknown): Promise<Response> {
      return toNotificationHttpResponse(
        await handleMarkNotificationRead(sessionProvider, notificationId),
      );
    },

    async markAllRead(): Promise<Response> {
      return toNotificationHttpResponse(
        await handleMarkAllNotificationsRead(sessionProvider),
      );
    },
  };
}
