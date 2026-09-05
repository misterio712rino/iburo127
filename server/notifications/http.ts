import "server-only";

import type { NotificationOperationResult } from "@/server/notifications/transport";
import { privateJsonResponse } from "@/server/http/private-json";

export function toNotificationHttpResponse<T>(result: NotificationOperationResult<T>): Response {
  if (result.ok) return privateJsonResponse({ ok: true, data: result.data });
  return privateJsonResponse(
    { ok: false, error: { code: result.error.code } },
    result.error.status,
  );
}
