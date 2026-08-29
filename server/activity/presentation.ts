import type { ActivityMetadata, CaseActivityRecord } from "@/server/domain/activity/contracts";

export type CaseActivityAudience = "CLIENT" | "STAFF";

export type CaseActivityView = {
  id: string;
  label: string;
  createdAt: Date;
  technical: {
    type: string;
    metadata: ActivityMetadata | null;
  } | null;
};

const TYPE_LABELS: Readonly<Record<string, string>> = {
  "auth.session.started": "Сессия подтверждена",
  "auth.mfa.enrolled": "Двухфакторная защита настроена",
  "questionnaire.started": "Анкета начата",
  "questionnaire.answer.updated": "Ответ анкеты обновлён",
  "questionnaire.section.completed": "Раздел анкеты завершён",
  "questionnaire.completed": "Анкета завершена",
  "practicum.lesson.completed": "Урок практикума завершён",
  "practicum.completed": "Практикум завершён",
  "task.status.changed": "Статус задачи изменён",
  "document.regenerated": "Документ сформирован заново",
  "document.sent_for_review": "Документ отправлен на проверку",
  "document.reviewed": "Документ проверен",
  "file.upload.registered": "Файл добавлен в дело",
  "file.download.authorized": "Файл скачан",
  "notification.created": "Уведомление создано",
};

export function buildCaseActivityView(
  records: readonly CaseActivityRecord[],
  audience: CaseActivityAudience,
): CaseActivityView[] {
  return records.map((record) => ({
    id: record.id,
    label: TYPE_LABELS[record.type] ?? (audience === "STAFF" ? record.type : "Событие по делу"),
    createdAt: record.createdAt,
    technical:
      audience === "STAFF"
        ? {
            type: record.type,
            metadata: record.metadata,
          }
        : null,
  }));
}
