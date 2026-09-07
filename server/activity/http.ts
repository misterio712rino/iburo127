import "server-only";

import type { ActivityOperationResult } from "@/server/activity/transport";
import { privateJsonResponse } from "@/server/http/private-json";

export function toActivityHttpResponse<T>(result: ActivityOperationResult<T>): Response {
  if (result.ok) return privateJsonResponse({ ok: true, data: result.data });
  return privateJsonResponse(
    { ok: false, error: { code: result.error.code } },
    result.error.status,
  );
}
