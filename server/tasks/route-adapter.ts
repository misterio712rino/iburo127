import "server-only";

import type { SessionProvider } from "@/server/auth/contracts";
import { handleGetTask, handleListTasks, handleUpdateTaskStatus } from "@/server/tasks/handlers";
import { toTaskHttpResponse } from "@/server/tasks/http";

async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

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
      const body = withAuthoritativeTaskId(await readJsonBody(request), taskId);
      return toTaskHttpResponse(await handleUpdateTaskStatus(sessionProvider, body));
    },
  };
}
