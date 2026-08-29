import "server-only";

import type { SessionProvider } from "@/server/auth/contracts";
import { readBoundedJsonBody } from "@/server/http/bounded-json-body";
import { handleGetTask, handleListTasks, handleUpdateTaskStatus } from "@/server/tasks/handlers";
import { toTaskHttpResponse } from "@/server/tasks/http";

function withAuthoritativeTaskId(body: unknown, taskId: unknown): unknown {
  if (!body || typeof body !== "object" || Array.isArray(body)) return body;
  return {
    ...(body as Record<string, unknown>),
    taskId,
  };
}

export function createTaskRouteAdapter(sessionProvider: SessionProvider) {
  return {
    async list(): Promise<Response> {
      return toTaskHttpResponse(await handleListTasks(sessionProvider));
    },

    async get(taskId: unknown): Promise<Response> {
      return toTaskHttpResponse(await handleGetTask(sessionProvider, taskId));
    },

    async updateStatus(taskId: unknown, request: Request): Promise<Response> {
      const bodyResult = await readBoundedJsonBody(request);
      if (!bodyResult.ok) return bodyResult.response;
      const body = withAuthoritativeTaskId(bodyResult.value, taskId);
      return toTaskHttpResponse(await handleUpdateTaskStatus(sessionProvider, body));
    },
  };
}
