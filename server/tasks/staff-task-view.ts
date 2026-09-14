import type { ClientCaseRecord } from "@/server/domain/client-cases/contracts";
import type { TaskRecord } from "@/server/domain/tasks/contracts";
import {
  getCaseStageDisplayLabel,
  getPlanDisplayLabel,
} from "@/lib/platform/case-progress";

export type StaffTaskCaseSummary = Pick<
  ClientCaseRecord,
  "id" | "caseNumber" | "clientId" | "planCode" | "stageCode" | "status"
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

export type StaffTaskPersonSummary = {
  id: string;
  displayName: string | null;
};

export type StaffTaskDueState = "OVERDUE" | "DUE" | "NO_DUE_DATE";

export type StaffTaskPresentationItem = {
  taskId: string;
  title: string;
  description: string | null;
  status: TaskRecord["status"];
  version: number;
  caseNumber: string;
  caseHref: string;
  clientDisplayName: string | null;
  assigneeDisplayName: string | null;
  planLabel: string;
  stageLabel: string;
  dueLabel: string | null;
  completedLabel: string | null;
  dueState: StaffTaskDueState;
  isOverdue: boolean;
  normalizedSearchText: string;
};

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatDateTime(value: Date | null) {
  return value ? DATE_TIME_FORMATTER.format(value) : null;
}

function normalizeSearchText(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("ru-RU")
    .replace(/\s+/gu, " ")
    .trim();
}

function taskPriority(task: TaskRecord, now: Date): number {
  if (task.status === "DONE") return 3;
  if (task.dueAt && task.dueAt.getTime() < now.getTime()) return 0;
  if (task.status === "WORKING") return 1;
  return 2;
}

function dueTime(task: TaskRecord): number {
  return task.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
}

export function buildStaffTaskQueue(
  tasks: readonly TaskRecord[],
  cases: readonly ClientCaseRecord[],
  now: Date = new Date(),
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
            clientId: clientCase.clientId,
            planCode: clientCase.planCode,
            stageCode: clientCase.stageCode,
            status: clientCase.status,
          },
        },
      ];
    })
    .sort(
      (left, right) =>
        taskPriority(left.task, now) - taskPriority(right.task, now) ||
        dueTime(left.task) - dueTime(right.task) ||
        left.task.createdAt.getTime() - right.task.createdAt.getTime(),
    );
}

export function buildStaffTaskPresentationItems(
  items: readonly StaffTaskQueueItem[],
  people: readonly StaffTaskPersonSummary[],
  now: Date = new Date(),
): readonly StaffTaskPresentationItem[] {
  const peopleById = new Map(people.map((person) => [person.id, person] as const));

  return items.map(({ task, clientCase }) => {
    const clientDisplayName = peopleById.get(clientCase.clientId)?.displayName?.trim() || null;
    const assigneeDisplayName = peopleById.get(task.assigneeId)?.displayName?.trim() || null;
    const isOverdue =
      task.status !== "DONE" && Boolean(task.dueAt && task.dueAt.getTime() < now.getTime());
    const dueState: StaffTaskDueState = isOverdue
      ? "OVERDUE"
      : task.dueAt
        ? "DUE"
        : "NO_DUE_DATE";
    const caseHref = `/portal/cases/${encodeURIComponent(clientCase.id)}`;

    return {
      taskId: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      version: task.version,
      caseNumber: clientCase.caseNumber,
      caseHref,
      clientDisplayName,
      assigneeDisplayName,
      planLabel: getPlanDisplayLabel(clientCase.planCode, "STAFF"),
      stageLabel: getCaseStageDisplayLabel(clientCase.stageCode, "STAFF"),
      dueLabel: formatDateTime(task.dueAt),
      completedLabel: formatDateTime(task.completedAt),
      dueState,
      isOverdue,
      normalizedSearchText: normalizeSearchText(
        [task.title, clientCase.caseNumber, clientDisplayName, assigneeDisplayName]
          .filter((value): value is string => Boolean(value))
          .join(" "),
      ),
    };
  });
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
