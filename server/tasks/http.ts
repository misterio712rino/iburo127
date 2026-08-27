import "server-only";

import type { TaskOperationResult } from "@/server/tasks/transport";

export function toTaskHttpResponse<T>(result: TaskOperationResult<T>): Response {
  if (result.ok) {
    return Response.json({ ok: true, data: result.data }, { status: 200 });
  }

  return Response.json(
    { ok: false, error: { code: result.error.code } },
    { status: result.error.status },
  );
}
