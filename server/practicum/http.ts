import "server-only";

import type { PracticumOperationResult } from "@/server/practicum/transport";
import { privateJsonResponse } from "@/server/http/private-json";

export function toPracticumHttpResponse<T>(result: PracticumOperationResult<T>): Response {
  if (result.ok) {
    return privateJsonResponse({ ok: true, data: result.data });
  }

  return privateJsonResponse(
    { ok: false, error: { code: result.error.code } },
    result.error.status,
  );
}
