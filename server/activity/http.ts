import "server-only";

import type { ActivityOperationResult } from "@/server/activity/transport";

export function toActivityHttpResponse<T>(result: ActivityOperationResult<T>): Response {
  if (result.ok) return Response.json({ ok: true, data: result.data }, { status: 200 });
  return Response.json(
    { ok: false, error: { code: result.error.code } },
    { status: result.error.status },
  );
}
