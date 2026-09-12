import "server-only";

import type { SessionProvider } from "@/server/auth/contracts";
import { requireServerActor } from "@/server/auth/runtime";
import type { TaskStatus } from "@/server/domain/tasks/contracts";
import { TASK_FORBIDDEN } from "@/server/domain/tasks/service";
import { taskService } from "@/server/tasks/runtime";

export async function getTask(sessionProvider: SessionProvider, taskId: string) {
  const actor = await requireServerActor(sessionProvider);
  return taskService.get(actor, taskId);
}

export async function listTasks(sessionProvider: SessionProvider) {
  const actor = await requireServerActor(sessionProvider);
  if (!actor.roles.includes("LAWYER") && !actor.roles.includes("MANAGER")) {
    throw new Error(TASK_FORBIDDEN);
  }
  return taskService.list(actor);
}

export async function createTask(
  sessionProvider: SessionProvider,
  input: {
    clientCaseId: string;
    title: string;
    description: string | null;
    dueAt: Date | null;
  },
) {
  const actor = await requireServerActor(sessionProvider);
  return taskService.create(actor, input);
}

export async function updateTaskStatus(
  sessionProvider: SessionProvider,
  input: { taskId: string; status: TaskStatus; expectedVersion: number },
) {
  const actor = await requireServerActor(sessionProvider);
  return taskService.updateStatus(actor, input);
}
