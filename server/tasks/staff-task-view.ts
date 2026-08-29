import type { ClientCaseRecord } from "@/server/domain/client-cases/contracts";
import type { TaskRecord } from "@/server/domain/tasks/contracts";

export type StaffTaskCaseSummary = Pick<
  ClientCaseRecord,
  "id" | "caseNumber" | "planCode" | "stageCode" | "status"
>;

export type StaffTaskQueueItem = {
  task: TaskRecord;
  clientCase: StaffTaskCaseSummary;
};

export type StaffTaskQueueSummary = {
  total: number;
  new: number;
  working: number;
  done: number;
  overdue: number;
};

function taskPriority(task: TaskRecord): number {
  if (task.status === "DONE") return 3;
  if (task.status === "WORKING") return 1;
  return 0;
}

function dueTime(task: TaskRecord): number {
  return task.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
}

export function buildStaffTaskQueue(
  tasks: readonly TaskRecord[],
  cases: readonly ClientCaseRecord[],
): readonly StaffTaskQueueItem[] {
  const casesById = new Map(cases.map((clientCase) => [clientCase.id, clientCase] as const));

  return tasks
    .flatMap((task) => {
      const clientCase = casesById.get(task.clientCaseId);
      if (!clientCase) return [];

      return [
        {
          task,
          clientCase: {
            id: clientCase.id,
            caseNumber: clientCase.caseNumber,
            planCode: clientCase.planCode,
            stageCode: clientCase.stageCode,
            status: clientCase.status,
          },
        },
      ];
    })
    .sort(
      (left, right) =>
        taskPriority(left.task) - taskPriority(right.task) ||
        dueTime(left.task) - dueTime(right.task) ||
        left.task.createdAt.getTime() - right.task.createdAt.getTime(),
    );
}

export function summarizeStaffTaskQueue(
  items: readonly StaffTaskQueueItem[],
  now: Date = new Date(),
): StaffTaskQueueSummary {
  let newCount = 0;
  let working = 0;
  let done = 0;
  let overdue = 0;

  for (const { task } of items) {
    if (task.status === "NEW") newCount += 1;
    if (task.status === "WORKING") working += 1;
    if (task.status === "DONE") done += 1;
    if (task.status !== "DONE" && task.dueAt && task.dueAt.getTime() < now.getTime()) overdue += 1;
  }

  return {
    total: items.length,
    new: newCount,
    working,
    done,
    overdue,
  };
}
