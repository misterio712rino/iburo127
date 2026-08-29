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

const CASE_STATUS_LABELS: Record<CaseStatus, string> = {
  DRAFT: "Подготовка",
  ACTIVE: "Активное",
  PAUSED: "Приостановлено",
  COMPLETED: "Завершено",
  ARCHIVED: "В архиве",
};

const PLAN_LABELS: Readonly<Record<string, string>> = {
  LITE: "Лайт",
  PRO: "Про",
  INDIVIDUAL: "Индивидуальный",
};

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

export function getCaseStageLabel(stageCode: string) {
  return CASE_STAGE_FLOW.find((stage) => stage.code === stageCode)?.label ?? stageCode;
}

export function getCaseStageDisplayLabel(
  stageCode: string,
  audience: CaseProgressAudience,
) {
  const known = CASE_STAGE_FLOW.find((stage) => stage.code === stageCode)?.label;
  if (known) return known;
  return audience === "CLIENT" ? "Этап уточняется" : stageCode;
}

export function getCaseStatusLabel(status: CaseStatus) {
  return CASE_STATUS_LABELS[status];
}

export function getPlanLabel(planCode: string) {
  return PLAN_LABELS[planCode] ?? planCode;
}

export function getPlanDisplayLabel(
  planCode: string,
  audience: CaseProgressAudience,
) {
  const known = PLAN_LABELS[planCode];
  if (known) return known;
  return audience === "CLIENT" ? "Тариф уточняется" : planCode;
}

function percentage(completed: number, total: number, forceComplete: boolean) {
  if (forceComplete) return 100;
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((Math.min(completed, total) / total) * 100)));
}

export function buildCaseProgressSummary(input: CaseProgressInput) {
  const stageIndex = CASE_STAGE_FLOW.findIndex((stage) => stage.code === input.stageCode);

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
      description: "Базовый практикум ещё не завершён. Прогресс сохраняется в материалах этого дела.",
      segment: "practicum",
    };
  } else if (documents.total === 0) {
    nextAction = {
      title: input.audience === "CLIENT" ? "Перейти к подготовке документов" : "Проверить подготовку документов",
      description: "По делу ещё нет сформированных документов. Откройте раздел документов для продолжения.",
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
          ? "Есть документы, переданные на проверку и требующие внимания сотрудника."
          : "Документы переданы юристу. Здесь появится обновлённый статус после проверки.",
      segment: "documents",
    };
  } else {
    nextAction = {
      title: "Следить за текущим этапом",
      description: "Основные материалы подготовлены. В истории дела отображаются подтверждённые действия и изменения статуса.",
      segment: "activity",
    };
  }

  return {
    stage: {
      code: input.stageCode,
      label: getCaseStageDisplayLabel(input.stageCode, input.audience),
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
