import "server-only";

import type { TaskOperationResult } from "@/server/tasks/transport";
import { privateJsonResponse } from "@/server/http/private-json";

export function toTaskHttpResponse<T>(result: TaskOperationResult<T>): Response {
  if (result.ok) {
    return privateJsonResponse({ ok: true, data: result.data });
  }

  return privateJsonResponse(
    { ok: false, error: { code: result.error.code } },
    result.error.status,
  );
}
