import type { AuthenticatedActor } from "@/server/domain/client-cases/contracts";

export const TASK_NOT_FOUND = "TASK_NOT_FOUND";
export const TASK_VERSION_CONFLICT = "TASK_VERSION_CONFLICT";

export type TaskStatus = "NEW" | "WORKING" | "DONE";

export type TaskRecord = {
  id: string;
  clientCaseId: string;
  assigneeId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  dueAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

export interface TaskRepository {
  getAccessible(actor: AuthenticatedActor, taskId: string): Promise<TaskRecord | null>;
  listAccessible(actor: AuthenticatedActor): Promise<readonly TaskRecord[]>;
  updateStatus(input: {
    actor: AuthenticatedActor;
    taskId: string;
    status: TaskStatus;
    expectedVersion: number;
  }): Promise<TaskRecord>;
}
