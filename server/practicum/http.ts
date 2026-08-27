import "server-only";

import type { PracticumOperationResult } from "@/server/practicum/transport";

export function toPracticumHttpResponse<T>(result: PracticumOperationResult<T>): Response {
  if (result.ok) {
    return Response.json({ ok: true, data: result.data }, { status: 200 });
  }

  return Response.json(
    { ok: false, error: { code: result.error.code } },
    { status: result.error.status },
  );
}
