import type { ClientDashboardData } from "../types";

export const PROCEDURE_STAGES = [
  "Начало работы",
  "Обучение",
  "Анкета",
  "Подготовка документов",
  "Проверка юристом",
  "Подача заявления",
  "Суд",
  "Процедура",
  "Завершено",
] as const;

export const CLIENT_DASHBOARDS = [
  {
    identityId: "alexander-lite",
    currentStageIndex: 1,
    nextStep: {
      title: "Продолжить обучение",
      description: "Завершите текущий урок, чтобы перейти к заполнению анкеты.",
      actionLabel: "Перейти к уроку",
    },
    modules: [
      { code: "PRACTICUM", title: "Практикум", summary: "3 из 12 уроков", detail: "Текущий урок: подготовка к процедуре", progress: 25, state: "active" },
      { code: "QUESTIONNAIRE", title: "Анкета", summary: "Не начата", detail: "Откроется после обучения", progress: 0, state: "upcoming" },
      { code: "DOCUMENTS", title: "Документы", summary: "Пока не сформированы", detail: "Появятся после заполнения анкеты", state: "upcoming" },
      { code: "CASE_PROGRESS", title: "Прогресс дела", summary: "Текущий этап: Обучение", detail: "Общий прогресс — 24%", progress: 24, state: "active" },
      { code: "MORTGAGE", title: "Анализ ипотечного жилья", summary: "Расширенная возможность", detail: "Индивидуальный разбор ситуации", state: "locked", lockLabel: "Доступно в тарифе ПРО" },
      { code: "AI_ASSISTANT", title: "AI-помощник", summary: "Готов помочь", detail: "Ответы с учётом материалов дела", state: "active" },
    ],
    activity: [
      { id: "lite-1", text: "Завершён урок «Первые шаги в процедуре»", dateLabel: "Сегодня, 10:20", type: "lesson" },
      { id: "lite-2", text: "Добавлены материалы к разделу «Финансовая ситуация»", dateLabel: "Вчера", type: "document" },
      { id: "lite-3", text: "Доступ к материалам дела активирован", dateLabel: "15 января", type: "document" },
    ],
    supportDescription: "Самостоятельный формат: AI-помощник доступен, сопровождение специалистом не входит в тариф.",
  },
  {
    identityId: "maria-pro",
    currentStageIndex: 2,
    nextStep: {
      title: "Продолжить анкету",
      description: "Заполните сведения об имуществе и обязательствах.",
      actionLabel: "Продолжить заполнение",
    },
    modules: [
      { code: "PRACTICUM", title: "Практикум", summary: "12 из 12 уроков", detail: "Обучение завершено", progress: 100, state: "completed" },
      { code: "QUESTIONNAIRE", title: "Анкета", summary: "7 из 12 разделов", detail: "Следующий раздел: имущество", progress: 58, state: "active" },
      { code: "DOCUMENTS", title: "Документы", summary: "Подготовка ещё не начата", detail: "Доступны после заполнения анкеты", state: "upcoming" },
      { code: "CASE_PROGRESS", title: "Прогресс дела", summary: "Текущий этап: Анкета", detail: "Общий прогресс — 46%", progress: 46, state: "active" },
      { code: "MORTGAGE", title: "Анализ ипотечного жилья", summary: "Индивидуальная оценка", detail: "Обстоятельства ипотечного жилья оценивает специалист", state: "active" },
      { code: "AI_ASSISTANT", title: "AI-помощник", summary: "Готов помочь", detail: "Ответы с учётом материалов дела", state: "active" },
    ],
    activity: [
      { id: "pro-1", text: "Заполнен раздел «Доходы»", dateLabel: "Сегодня, 12:45", type: "questionnaire" },
      { id: "pro-2", text: "Анна Орлова проверила данные анкеты", dateLabel: "Сегодня, 09:10", type: "lawyer" },
      { id: "pro-3", text: "Завершён урок «Что происходит после подачи заявления»", dateLabel: "2 дня назад", type: "lesson" },
    ],
    supportDescription: "Проверяет анкету и помогает учитывать особенности вашей ситуации.",
  },
  {
    identityId: "dmitry-individual",
    currentStageIndex: 3,
    nextStep: {
      title: "Проверить подготовленные документы",
      description: "Документы сформированы на основе анкеты и готовы к проверке.",
      actionLabel: "Открыть документы",
    },
    modules: [
      { code: "PRACTICUM", title: "Практикум", summary: "12 из 12 уроков", detail: "Обучение завершено", progress: 100, state: "completed" },
      { code: "QUESTIONNAIRE", title: "Анкета", summary: "12 из 12 разделов", detail: "Данные проверены", progress: 100, state: "completed" },
      { code: "DOCUMENTS", title: "Документы", summary: "3 документа подготовлено", detail: "Ожидают вашей проверки", progress: 68, state: "active" },
      { code: "CASE_PROGRESS", title: "Прогресс дела", summary: "Этап: Подготовка документов", detail: "Общий прогресс — 63%", progress: 63, state: "active" },
      { code: "MORTGAGE", title: "Анализ ипотечного жилья", summary: "Индивидуальная оценка", detail: "Обстоятельства ипотечного жилья оценивает специалист", state: "active" },
      { code: "AI_ASSISTANT", title: "AI-помощник", summary: "Готов помочь", detail: "Учитывает материалы вашего дела", state: "active" },
    ],
    activity: [
      { id: "individual-1", text: "Документ «Опись имущества» сформирован", dateLabel: "Сегодня, 14:30", type: "document" },
      { id: "individual-2", text: "Анна Орлова проверила данные анкеты", dateLabel: "Сегодня, 11:05", type: "lawyer" },
      { id: "individual-3", text: "Сформировано заявление о признании банкротом", dateLabel: "Вчера", type: "document" },
      { id: "individual-4", text: "Анкета заполнена полностью", dateLabel: "2 дня назад", type: "questionnaire" },
    ],
    supportDescription: "Персонально сопровождает дело и проверяет подготовленные материалы.",
  },
] as const satisfies readonly ClientDashboardData[];

export function getDashboardForIdentity(identityId: string): ClientDashboardData | undefined {
  return CLIENT_DASHBOARDS.find((dashboard) => dashboard.identityId === identityId);
}