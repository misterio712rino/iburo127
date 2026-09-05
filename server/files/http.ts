import "server-only";

import type { StoredFileOperationResult } from "@/server/files/transport";
import { privateJsonResponse } from "@/server/http/private-json";

export function toStoredFileHttpResponse<T>(result: StoredFileOperationResult<T>): Response {
  if (result.ok) return privateJsonResponse({ ok: true, data: result.data });
  return privateJsonResponse(
    { ok: false, error: { code: result.error.code } },
    result.error.status,
  );
}
