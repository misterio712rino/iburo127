import type { AuthenticatedActor } from "@/server/domain/client-cases/contracts";
import type { TaskRecord, TaskRepository, TaskStatus } from "@/server/domain/tasks/contracts";

export const TASK_FORBIDDEN = "TASK_FORBIDDEN";
export const TASK_INVALID_STATUS = "TASK_INVALID_STATUS";

function canAccessTask(actor: AuthenticatedActor, task: TaskRecord) {
  if (actor.roles.includes("MANAGER")) return true;
  return actor.roles.includes("LAWYER") && task.assigneeId === actor.userId;
}

function assertTaskStatus(status: TaskStatus) {
  if (status !== "NEW" && status !== "WORKING" && status !== "DONE") {
    throw new Error(TASK_INVALID_STATUS);
  }
}

export class TaskService {
  constructor(private readonly repository: TaskRepository) {}

  async get(actor: AuthenticatedActor, taskId: string) {
    const task = await this.repository.getAccessible(actor, taskId);
    if (!task || !canAccessTask(actor, task)) return null;
    return task;
  }

  async list(actor: AuthenticatedActor) {
    const tasks = await this.repository.listAccessible(actor);
    return tasks.filter((task) => canAccessTask(actor, task));
  }

  async updateStatus(
    actor: AuthenticatedActor,
    input: { taskId: string; status: TaskStatus; expectedVersion?: number },
  ) {
    assertTaskStatus(input.status);
    const task = await this.get(actor, input.taskId);
    if (!task) throw new Error(TASK_FORBIDDEN);

    return this.repository.updateStatus({ actor, ...input });
  }
}
