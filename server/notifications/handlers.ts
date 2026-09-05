import "server-only";

import type { SessionProvider } from "@/server/auth/contracts";
import { listNotifications, markNotificationRead } from "@/server/notifications/operations";
import { parseNotificationId, parseNotificationLimit } from "@/server/notifications/input";
import { executeNotificationOperation } from "@/server/notifications/transport";

export function handleListNotifications(sessionProvider: SessionProvider, limit?: unknown) {
  return executeNotificationOperation(() =>
    listNotifications(sessionProvider, parseNotificationLimit(limit)),
  );
}

export function handleMarkNotificationRead(
  sessionProvider: SessionProvider,
  notificationId: unknown,
) {
  return executeNotificationOperation(() =>
    markNotificationRead(sessionProvider, parseNotificationId(notificationId)),
  );
}
