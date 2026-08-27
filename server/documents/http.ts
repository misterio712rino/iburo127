import "server-only";

import type { DocumentOperationResult } from "@/server/documents/transport";

export function toDocumentHttpResponse<T>(result: DocumentOperationResult<T>): Response {
  if (result.ok) {
    return Response.json({ ok: true, data: result.data }, { status: 200 });
  }

  return Response.json(
    { ok: false, error: { code: result.error.code } },
    { status: result.error.status },
  );
}
