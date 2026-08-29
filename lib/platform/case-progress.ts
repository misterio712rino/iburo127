export const CASE_STAGE_FLOW = [
  { code: "ONBOARDING", label: "Онбординг" },
  { code: "EDUCATION", label: "Обучение" },
  { code: "QUESTIONNAIRE", label: "Анкетирование" },
  { code: "DOCUMENT_PREPARATION", label: "Подготовка документов" },
  { code: "LAWYER_REVIEW", label: "Проверка юристом" },
  { code: "FILING", label: "Подача документов" },
  { code: "COURT", label: "Суд" },
  { code: "PROCEDURE", label: "Процедура банкротства" },
  { code: "COMPLETED", label: "Завершено" },
] as const;

type QuestionnaireStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
type PracticumStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
type CaseStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED" | "ARCHIVED";
type DocumentStatus =
  | "WAITING_DATA"
  | "DRAFT"
  | "READY_FOR_REVIEW"
  | "SENT_FOR_REVIEW"
  | "REVIEWED";

export type CaseProgressAudience = "CLIENT" | "STAFF";

export type CaseProgressInput = {
  audience: CaseProgressAudience;
  caseStatus: CaseStatus;
  stageCode: string;
  questionnaire: {
    status: QuestionnaireStatus;
    completedSectionCount: number;
    totalSectionCount: number;
  } | null;
  practicum: {
    status: PracticumStatus;
    completedLessonCount: number;
    totalLessonCount: number;
  } | null;
  documents: readonly { status: DocumentStatus }[];
  readyFileCount: number;
};

function percentage(completed: number, total: number, forceComplete: boolean) {
  if (forceComplete) return 100;
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((Math.min(completed, total) / total) * 100)));
}

export function buildCaseProgressSummary(input: CaseProgressInput) {
  const stageIndex = CASE_STAGE_FLOW.findIndex((stage) => stage.code === input.stageCode);
  const stageDefinition = stageIndex >= 0 ? CASE_STAGE_FLOW[stageIndex] : null;

  const questionnairePercent = percentage(
    input.questionnaire?.completedSectionCount ?? 0,
    input.questionnaire?.totalSectionCount ?? 0,
    input.questionnaire?.status === "COMPLETED",
  );
  const practicumPercent = percentage(
    input.practicum?.completedLessonCount ?? 0,
    input.practicum?.totalLessonCount ?? 0,
    input.practicum?.status === "COMPLETED",
  );

  const documents = {
    total: input.documents.length,
    waitingData: input.documents.filter((document) => document.status === "WAITING_DATA").length,
    draft: input.documents.filter((document) => document.status === "DRAFT").length,
    readyForReview: input.documents.filter((document) => document.status === "READY_FOR_REVIEW").length,
    sentForReview: input.documents.filter((document) => document.status === "SENT_FOR_REVIEW").length,
    reviewed: input.documents.filter((document) => document.status === "REVIEWED").length,
  };

  const caseClosed =
    input.caseStatus === "COMPLETED" ||
    input.caseStatus === "ARCHIVED" ||
    input.stageCode === "COMPLETED";

  let nextAction: { title: string; description: string; segment: string };

  if (caseClosed) {
    nextAction = {
      title: "Дело завершено",
      description: "Откройте историю дела, чтобы просмотреть зафиксированные этапы и действия.",
      segment: "activity",
    };
  } else if (questionnairePercent < 100) {
    nextAction = {
      title: input.audience === "CLIENT" ? "Продолжить анкету" : "Проверить заполнение анкеты",
      description: "Анкета ещё не завершена. Данные из неё используются при подготовке документов дела.",
      segment: "questionnaire",
    };
  } else if (practicumPercent < 100) {
    nextAction = {
      title: input.audience === "CLIENT" ? "Продолжить практикум" : "Проверить прогресс практикума",
      description: "Базовый практикум ещё не завершён. Прогресс хранится в серверной базе по этому делу.",
      segment: "practicum",
    };
  } else if (documents.total === 0) {
    nextAction = {
      title: input.audience === "CLIENT" ? "Перейти к подготовке документов" : "Проверить подготовку документов",
      description: "По делу ещё нет сформированных документов. Откройте модуль документов для продолжения.",
      segment: "documents",
    };
  } else if (documents.waitingData + documents.draft + documents.readyForReview > 0) {
    nextAction = {
      title: input.audience === "CLIENT" ? "Продолжить подготовку документов" : "Проверить документы в работе",
      description: "Часть документов ещё готовится или ожидает передачи на проверку.",
      segment: "documents",
    };
  } else if (documents.sentForReview > 0) {
    nextAction = {
      title: input.audience === "STAFF" ? "Проверить документы клиента" : "Ожидать проверку документов",
      description:
        input.audience === "STAFF"
          ? "Есть документы, переданные на проверку и требующие staff-действия."
          : "Документы переданы на проверку юристу. Статус изменится после серверного подтверждения.",
      segment: "documents",
    };
  } else {
    nextAction = {
      title: "Следить за текущим этапом",
      description: "Основные материалы подготовлены. История дела показывает подтверждённые действия и изменения статуса.",
      segment: "activity",
    };
  }

  return {
    stage: {
      code: input.stageCode,
      label: stageDefinition?.label ?? input.stageCode,
      position: stageIndex >= 0 ? stageIndex + 1 : null,
      total: CASE_STAGE_FLOW.length,
    },
    questionnaire: {
      status: input.questionnaire?.status ?? "NOT_STARTED",
      completed: input.questionnaire?.completedSectionCount ?? 0,
      total: input.questionnaire?.totalSectionCount ?? 0,
      percent: questionnairePercent,
    },
    practicum: {
      status: input.practicum?.status ?? "NOT_STARTED",
      completed: input.practicum?.completedLessonCount ?? 0,
      total: input.practicum?.totalLessonCount ?? 0,
      percent: practicumPercent,
    },
    documents,
    readyFileCount: Math.max(0, input.readyFileCount),
    nextAction,
  };
}
