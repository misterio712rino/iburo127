import type { AiAction, AiAssistantProvider, AiContext, AiReply } from "../types";

export const AI_SUGGESTIONS = [
  "Что мне делать дальше?",
  "Какие документы уже готовы?",
  "Зачем нужна проверка юриста?",
  "Что означает этап «Подготовка документов»?",
  "Какие данные использованы в документах?",
  "Что будет после проверки документов?",
] as const;

const actions = {
  documents: { type: "OPEN_DOCUMENTS", label: "Открыть документы", href: "/app/client/documents" },
  questionnaire: { type: "OPEN_QUESTIONNAIRE", label: "Открыть анкету", href: "/app/client/questionnaire" },
  practicum: { type: "OPEN_PRACTICUM", label: "Перейти в Практикум", href: "/app/client/practicum" },
} satisfies Record<string, AiAction>;

function includesAny(value: string, words: readonly string[]) { return words.some((word) => value.includes(word)); }
function documentsText(context: AiContext) {
  if (!context.documents.readyCount) return "Сейчас готовых к проверке документов нет. Черновики будут обновляться по мере заполнения анкеты.";
  return `Готовы к проверке: ${context.documents.readyTitles.join("; ")}. Всего — ${context.documents.readyCount}. Перед использованием каждый черновик должен проверить специалист.`;
}

export function getInitialAiMessage(context: AiContext): string {
  const documentPhrase = context.documents.readyCount === 3
    ? "три документа уже подготовлены и готовы к проверке"
    : `${context.documents.readyCount} документов подготовлено для проверки`;
  return `Здравствуйте, ${context.firstName}. Я вижу, что вы завершили анкету, а ${documentPhrase}. Сейчас ваш следующий шаг — проверить сформированные документы перед передачей юристу.\n\nЯ могу объяснить, что содержится в документах, какие данные использованы или что будет происходить на следующем этапе.`;
}

export function classifyDemoIntent(message: string) {
  const value = message.toLocaleLowerCase("ru").replace(/ё/g, "е");
  if (includesAny(value, ["скрыть", "спрятать", "не указывать", "переписать имущество", "утаить"])) return "CONCEALMENT";
  if (includesAny(value, ["точно спиш", "гарантир", "точно сохран", "обязательно спиш", "обещаете"])) return "GUARANTEE";
  if (includesAny(value, ["ипотек", "ипотечной квартир", "жилье", "квартирой"])) return "MORTGAGE";
  if (includesAny(value, ["что делать дальше", "что мне делать", "следующ", "после проверки"])) return "NEXT_STEP";
  if (includesAny(value, ["документ", "заявлен", "опись", "кредитор", "данные использованы"])) return "DOCUMENTS";
  if (includesAny(value, ["юрист", "анна", "специалист", "зачем нужна проверка"])) return "LAWYER";
  if (includesAny(value, ["анкет", "сведения", "ответы"])) return "QUESTIONNAIRE";
  if (includesAny(value, ["практикум", "урок", "обучен"])) return "PRACTICUM";
  if (includesAny(value, ["этап", "статус", "прогресс", "дело"])) return "CASE_STATUS";
  if (includesAny(value, ["помоги", "возможност", "умеешь"])) return "GENERAL_HELP";
  return "UNKNOWN";
}

function makeReply(context: AiContext, message: string): AiReply {
  switch (classifyDemoIntent(message)) {
    case "CONCEALMENT": return { content: "Я не могу помогать скрывать имущество или предоставлять недостоверные сведения. Для процедуры важно указывать информацию корректно. Если ситуация сложная, лучше обсудить её со специалистом." };
    case "GUARANTEE": return { content: "Результат процедуры нельзя гарантировать заранее: он зависит от обстоятельств дела и юридической оценки. Я могу объяснить общий процесс, а итоговый вывод должен сделать специалист." };
    case "MORTGAGE": return { content: "В вашем деле указано ипотечное жильё. Такие ситуации требуют отдельного анализа условий кредита, статуса жилья и других обстоятельств. В тарифе ИНДИВИДУАЛЬНЫЙ предусмотрен персональный анализ, поэтому итоговую оценку должен дать специалист." };
    case "NEXT_STEP": return { content: `Сейчас ваше дело находится на этапе «${context.currentStage}». Анкета заполнена на ${context.questionnaireProgress}%, и ${context.documents.readyCount} документа готовы к проверке. Рекомендую открыть раздел «Документы», проверить сведения и затем передать черновики ${context.assignedLawyer} на проверку.`, action: actions.documents };
    case "DOCUMENTS": return { content: `${documentsText(context)} Значения подставлены из нормализованных ответов анкеты, а источник ключевых полей указан в карточке документа.`, action: actions.documents };
    case "LAWYER": return { content: `AI-помощник помогает ориентироваться и объяснять информацию, но итоговую проверку документов и юридическую оценку выполняет специалист. Ваше дело сопровождает ${context.assignedLawyer}.` };
    case "QUESTIONNAIRE": return { content: `Анкета заполнена на ${context.questionnaireProgress}%. Её нормализованные ответы используются для подготовки черновиков документов. Если данные изменятся, документы можно обновить.`, action: actions.questionnaire };
    case "PRACTICUM": return { content: `Практикум завершён на ${context.practicumProgress}%. Он объясняет общий порядок процедуры и помогает подготовиться к следующим этапам.`, action: actions.practicum };
    case "CASE_STATUS": return { content: `Дело № ${context.caseNumber} активно. Текущий этап — «${context.currentStage}», общий прогресс — ${context.overallProgress}%. Следующий ориентир: ${context.nextStep.toLocaleLowerCase("ru")}.`, action: actions.documents };
    case "GENERAL_HELP": return { content: "Я могу объяснить текущий этап, состояние анкеты и документов, материалы Практикума или помочь подготовить вопрос специалисту." };
    default: return { content: "Я не хочу давать неточный ответ на этот вопрос. Могу помочь разобраться в этапах дела, анкете, документах или работе платформы. Для юридической оценки лучше обсудить вопрос со специалистом." };
  }
}

export const demoAssistant: AiAssistantProvider = {
  async reply({ context, message }) { return makeReply(context, message); },
};
