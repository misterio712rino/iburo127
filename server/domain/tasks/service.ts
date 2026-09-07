import { canAccessClientCaseAsStaff } from "@/server/domain/client-cases/access-policy";
import type { AuthenticatedActor } from "@/server/domain/client-cases/contracts";
import { ClientCaseService } from "@/server/domain/client-cases/service";
import type { TaskRecord, TaskRepository, TaskStatus } from "@/server/domain/tasks/contracts";

export const TASK_FORBIDDEN = "TASK_FORBIDDEN";
export const TASK_INVALID_STATUS = "TASK_INVALID_STATUS";
export const TASK_INVALID_DETAILS = "TASK_INVALID_DETAILS";
export const TASK_CASE_UNASSIGNED = "TASK_CASE_UNASSIGNED";

const MAX_TASK_TITLE_LENGTH = 160;
const MAX_TASK_DESCRIPTION_LENGTH = 2000;

function canAccessTask(actor: AuthenticatedActor, task: TaskRecord) {
  if (actor.roles.includes("MANAGER")) return true;
  return actor.roles.includes("LAWYER") && task.assigneeId === actor.userId;
}

function assertTaskStatus(status: TaskStatus) {
  if (status !== "NEW" && status !== "WORKING" && status !== "DONE") {
    throw new Error(TASK_INVALID_STATUS);
  }
}

function normalizeTaskDetails(input: {
  title: string;
  description: string | null;
  dueAt: Date | null;
}) {
  const title = input.title.trim();
  const description = input.description?.trim() || null;
  if (!title || title.length > MAX_TASK_TITLE_LENGTH) {
    throw new Error(TASK_INVALID_DETAILS);
  }
  if (description && description.length > MAX_TASK_DESCRIPTION_LENGTH) {
    throw new Error(TASK_INVALID_DETAILS);
  }
  if (input.dueAt && Number.isNaN(input.dueAt.getTime())) {
    throw new Error(TASK_INVALID_DETAILS);
  }
  return { title, description, dueAt: input.dueAt };
}

export class TaskService {
  constructor(
    private readonly cases: ClientCaseService,
    private readonly repository: TaskRepository,
  ) {}

  private async canAccessTaskCaseAsStaff(
    actor: AuthenticatedActor,
    task: TaskRecord,
  ) {
    const clientCase = await this.cases.getCase(actor, { caseId: task.clientCaseId });
    return Boolean(clientCase && canAccessClientCaseAsStaff(actor, clientCase));
  }

  async get(actor: AuthenticatedActor, taskId: string) {
    const task = await this.repository.getAccessible(actor, taskId);
    if (!task || !canAccessTask(actor, task)) return null;
    if (!(await this.canAccessTaskCaseAsStaff(actor, task))) return null;
    return task;
  }

  async list(actor: AuthenticatedActor) {
    const [tasks, cases] = await Promise.all([
      this.repository.listAccessible(actor),
      this.cases.listCases(actor),
    ]);
    const staffCaseIds = new Set(
      cases
        .filter((clientCase) => canAccessClientCaseAsStaff(actor, clientCase))
        .map((clientCase) => clientCase.id),
    );

    return tasks.filter(
      (task) => canAccessTask(actor, task) && staffCaseIds.has(task.clientCaseId),
    );
  }

  async create(
    actor: AuthenticatedActor,
    input: {
      clientCaseId: string;
      title: string;
      description: string | null;
      dueAt: Date | null;
    },
  ) {
    const clientCase = await this.cases.getCase(actor, { caseId: input.clientCaseId });
    const assignedLawyer =
      clientCase &&
      !actor.roles.includes("MANAGER") &&
      actor.roles.includes("LAWYER") &&
      clientCase.clientId !== actor.userId &&
      clientCase.assignedLawyerId === actor.userId;
    if (!assignedLawyer) {
      throw new Error(TASK_FORBIDDEN);
    }

    const details = normalizeTaskDetails(input);
    return this.repository.create({
      actor,
      clientCaseId: clientCase.id,
      assigneeId: actor.userId,
      ...details,
    });
  }

  async updateStatus(
    actor: AuthenticatedActor,
    input: { taskId: string; status: TaskStatus; expectedVersion: number },
  ) {
    assertTaskStatus(input.status);
    if (actor.roles.includes("MANAGER") || !actor.roles.includes("LAWYER")) {
      throw new Error(TASK_FORBIDDEN);
    }
    const task = await this.get(actor, input.taskId);
    if (!task) throw new Error(TASK_FORBIDDEN);

    return this.repository.updateStatus({ actor, ...input });
  }
}
