import "server-only";

import type { SessionProvider } from "@/server/auth/contracts";
import { requireServerActor } from "@/server/auth/runtime";
import { notificationService } from "@/server/notifications/runtime";

export async function listNotifications(
  sessionProvider: SessionProvider,
  limit?: number,
) {
  const actor = await requireServerActor(sessionProvider);
  return notificationService.listForActor(actor, limit);
}

export async function markNotificationRead(
  sessionProvider: SessionProvider,
  notificationId: string,
) {
  const actor = await requireServerActor(sessionProvider);
  return notificationService.markRead(actor, notificationId);
}
