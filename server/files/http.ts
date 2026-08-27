import "server-only";

import type { StoredFileOperationResult } from "@/server/files/transport";

export function toStoredFileHttpResponse<T>(result: StoredFileOperationResult<T>): Response {
  if (result.ok) return Response.json({ ok: true, data: result.data }, { status: 200 });
  return Response.json(
    { ok: false, error: { code: result.error.code } },
    { status: result.error.status },
  );
}
