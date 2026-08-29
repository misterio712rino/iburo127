import type {
  NotificationDeliveryChannel,
  NotificationRecord,
} from "@/server/domain/notifications/contracts";

export type TaskReminderCandidate = {
  id: string;
  clientCaseId: string;
  assigneeId: string;
  caseNumber: string;
  dueAt: Date | null;
  createdAt: Date;
};

export interface TaskReminderSource {
  listRecentlyAssigned(input: {
    createdAfter: Date;
    limit: number;
  }): Promise<readonly TaskReminderCandidate[]>;
  listDueSoon(input: {
    after: Date;
    through: Date;
    limit: number;
  }): Promise<readonly TaskReminderCandidate[]>;
  listRecentlyOverdue(input: {
    after: Date;
    through: Date;
    limit: number;
  }): Promise<readonly TaskReminderCandidate[]>;
}

export interface TaskReminderNotificationSink {
  createSystem(input: {
    userId: string;
    clientCaseId?: string | null;
    dedupeKey?: string | null;
    type: string;
    title: string;
    body: string;
    deliveryChannels?: readonly NotificationDeliveryChannel[];
  }): Promise<NotificationRecord>;
}

export type TaskReminderBatchResult = {
  scanned: number;
  createdOrExisting: number;
  assigned: number;
  dueSoon: number;
  overdue: number;
};

const ASSIGNED_LOOKBACK_MS = 24 * 60 * 60_000;
const DUE_SOON_MS = 24 * 60 * 60_000;
const OVERDUE_LOOKBACK_MS = 7 * 24 * 60 * 60_000;
const MAX_BATCH_LIMIT = 100;

function boundedLimit(limit: number) {
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_BATCH_LIMIT) {
    throw new Error("TASK_REMINDER_INVALID_LIMIT");
  }
  return limit;
}

function reminderKey(
  kind: "assigned" | "due-soon" | "overdue",
  task: TaskReminderCandidate,
) {
  const version = kind === "assigned" ? task.createdAt.getTime() : task.dueAt?.getTime();
  if (!Number.isFinite(version)) throw new Error("TASK_REMINDER_INVALID_CANDIDATE");
  return `task:${kind}:${task.id}:${version}`;
}

function formatDueAt(dueAt: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Moscow",
  }).format(dueAt);
}

export class TaskReminderWorker {
  constructor(
    private readonly source: TaskReminderSource,
    private readonly notifications: TaskReminderNotificationSink,
  ) {}

  async processBatch(input: { now?: Date; limit?: number } = {}): Promise<TaskReminderBatchResult> {
    const now = input.now ?? new Date();
    if (Number.isNaN(now.getTime())) throw new Error("TASK_REMINDER_INVALID_NOW");
    const limit = boundedLimit(input.limit ?? 50);

    const [assigned, dueSoon, overdue] = await Promise.all([
      this.source.listRecentlyAssigned({
        createdAfter: new Date(now.getTime() - ASSIGNED_LOOKBACK_MS),
        limit,
      }),
      this.source.listDueSoon({
        after: now,
        through: new Date(now.getTime() + DUE_SOON_MS),
        limit,
      }),
      this.source.listRecentlyOverdue({
        after: new Date(now.getTime() - OVERDUE_LOOKBACK_MS),
        through: now,
        limit,
      }),
    ]);

    let createdOrExisting = 0;

    for (const task of assigned) {
      await this.notifications.createSystem({
        userId: task.assigneeId,
        clientCaseId: task.clientCaseId,
        dedupeKey: reminderKey("assigned", task),
        type: "task.assigned",
        title: "Вам назначена новая задача",
        body: `По делу ${task.caseNumber} появилась новая рабочая задача. Откройте очередь задач, чтобы посмотреть детали.`,
      });
      createdOrExisting += 1;
    }

    for (const task of dueSoon) {
      if (!task.dueAt) continue;
      await this.notifications.createSystem({
        userId: task.assigneeId,
        clientCaseId: task.clientCaseId,
        dedupeKey: reminderKey("due-soon", task),
        type: "task.due_soon",
        title: "Срок задачи приближается",
        body: `По делу ${task.caseNumber} срок задачи наступит ${formatDueAt(task.dueAt)}. Проверьте рабочую очередь.`,
      });
      createdOrExisting += 1;
    }

    for (const task of overdue) {
      if (!task.dueAt) continue;
      await this.notifications.createSystem({
        userId: task.assigneeId,
        clientCaseId: task.clientCaseId,
        dedupeKey: reminderKey("overdue", task),
        type: "task.overdue",
        title: "Задача просрочена",
        body: `По делу ${task.caseNumber} срок задачи истёк ${formatDueAt(task.dueAt)}. Проверьте рабочую очередь.`,
      });
      createdOrExisting += 1;
    }

    return {
      scanned: assigned.length + dueSoon.length + overdue.length,
      createdOrExisting,
      assigned: assigned.length,
      dueSoon: dueSoon.length,
      overdue: overdue.length,
    };
  }
}
