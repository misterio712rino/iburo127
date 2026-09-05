import "server-only";

import type { DocumentOperationResult } from "@/server/documents/transport";
import { privateJsonResponse } from "@/server/http/private-json";

export function toDocumentHttpResponse<T>(result: DocumentOperationResult<T>): Response {
  if (result.ok) {
    return privateJsonResponse({ ok: true, data: result.data });
  }

  return privateJsonResponse(
    { ok: false, error: { code: result.error.code } },
    result.error.status,
  );
}
