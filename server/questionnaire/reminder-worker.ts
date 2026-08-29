import type { NotificationRecord } from "@/server/domain/notifications/contracts";

export type QuestionnaireReminderCandidate = {
  clientCaseId: string;
  clientId: string;
  caseNumber: string;
  updatedAt: Date;
};

export interface QuestionnaireReminderSource {
  listInactive(input: {
    inactiveBefore: Date;
    remindedAfter: Date;
    limit: number;
  }): Promise<readonly QuestionnaireReminderCandidate[]>;
}

export interface QuestionnaireReminderNotificationSink {
  createSystem(input: {
    userId: string;
    clientCaseId?: string | null;
    dedupeKey?: string | null;
    type: string;
    title: string;
    body: string;
  }): Promise<NotificationRecord>;
}

export type QuestionnaireReminderBatchResult = {
  scanned: number;
  createdOrExisting: number;
};

const INACTIVITY_MS = 48 * 60 * 60_000;
const REMINDER_COOLDOWN_MS = 72 * 60 * 60_000;
const MAX_BATCH_LIMIT = 100;

function boundedLimit(limit: number) {
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_BATCH_LIMIT) {
    throw new Error("QUESTIONNAIRE_REMINDER_INVALID_LIMIT");
  }
  return limit;
}

function reminderDay(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = new Map(parts.map((part) => [part.type, part.value]));
  return `${values.get("year")}-${values.get("month")}-${values.get("day")}`;
}

export class QuestionnaireReminderWorker {
  constructor(
    private readonly source: QuestionnaireReminderSource,
    private readonly notifications: QuestionnaireReminderNotificationSink,
  ) {}

  async processBatch(input: { now?: Date; limit?: number } = {}): Promise<QuestionnaireReminderBatchResult> {
    const now = input.now ?? new Date();
    if (Number.isNaN(now.getTime())) throw new Error("QUESTIONNAIRE_REMINDER_INVALID_NOW");
    const limit = boundedLimit(input.limit ?? 50);
    const candidates = await this.source.listInactive({
      inactiveBefore: new Date(now.getTime() - INACTIVITY_MS),
      remindedAfter: new Date(now.getTime() - REMINDER_COOLDOWN_MS),
      limit,
    });

    let createdOrExisting = 0;
    const day = reminderDay(now);
    for (const candidate of candidates) {
      await this.notifications.createSystem({
        userId: candidate.clientId,
        clientCaseId: candidate.clientCaseId,
        dedupeKey: `questionnaire:reminder:${candidate.clientCaseId}:${day}`,
        type: "questionnaire.reminder",
        title: "Продолжите заполнение анкеты",
        body: `По делу ${candidate.caseNumber} анкета ещё не завершена. Продолжите заполнение с того места, где остановились.`,
      });
      createdOrExisting += 1;
    }

    return {
      scanned: candidates.length,
      createdOrExisting,
    };
  }
}
