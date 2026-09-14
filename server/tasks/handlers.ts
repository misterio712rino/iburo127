import "server-only";

import type { SessionProvider } from "@/server/auth/contracts";
import { createTask, getTask, listTasks, updateTaskStatus } from "@/server/tasks/operations";
import {
  parseCreateTaskInput,
  parseTaskId,
  parseUpdateTaskStatusInput,
} from "@/server/tasks/input";
import { executeTaskOperation } from "@/server/tasks/transport";

export function handleGetTask(sessionProvider: SessionProvider, taskId: unknown) {
  return executeTaskOperation(() => getTask(sessionProvider, parseTaskId(taskId)));
}

export function handleListTasks(sessionProvider: SessionProvider) {
  return executeTaskOperation(() => listTasks(sessionProvider));
}

export function handleCreateTask(sessionProvider: SessionProvider, input: unknown) {
  return executeTaskOperation(() => createTask(sessionProvider, parseCreateTaskInput(input)));
}

export function handleUpdateTaskStatus(sessionProvider: SessionProvider, input: unknown) {
  return executeTaskOperation(() =>
    updateTaskStatus(sessionProvider, parseUpdateTaskStatusInput(input)),
  );
}
