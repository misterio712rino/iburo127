import "server-only";

import type { NotificationOperationResult } from "@/server/notifications/transport";

export function toNotificationHttpResponse<T>(result: NotificationOperationResult<T>): Response {
  if (result.ok) return Response.json({ ok: true, data: result.data }, { status: 200 });
  return Response.json(
    { ok: false, error: { code: result.error.code } },
    { status: result.error.status },
  );
}
