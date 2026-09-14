import type { DemoClientCase, DemoIdentity, GeneratedDocument, LawyerCaseSummary, LawyerPriority } from "../types";

type OperationalState = Omit<LawyerCaseSummary, "identity" | "clientCase" | "priority" | "attentionReason" | "lastActivity">;

function priorityFor(clientCase: DemoClientCase, documents: readonly GeneratedDocument[]): LawyerPriority {
  if (documents.some((document) => document.status === "sent_for_review" || document.status === "ready_for_review")) return "high";
  if (clientCase.plan === "PRO") return "medium";
  return "routine";
}

export function deriveLawyerCase(identity: DemoIdentity, clientCase: DemoClientCase, state: OperationalState): LawyerCaseSummary {
  const priority = priorityFor(clientCase, state.documents);
  const sent = state.documents.filter((document) => document.status === "sent_for_review").length;
  const reviewed = state.documents.filter((document) => document.status === "reviewed").length;
  const ready = state.documents.filter((document) => document.status === "ready_for_review").length;
  const attentionReason = sent ? `${sent} документ${sent === 1 ? "" : "а"} передано на проверку` : ready ? `${ready} документа готовы к проверке` : priority === "medium" ? `Анкета заполнена на ${state.questionnaire.progress}%` : "Обучение продолжается по плану";
  const lastActivity = reviewed ? "Документ отмечен как проверенный" : sent ? "Документ передан юристу" : ready ? "Сформированы документы" : state.questionnaire.progress ? "Обновлены данные анкеты" : "Продолжается Практикум";
  return { identity, clientCase, ...state, priority, attentionReason, lastActivity };
}

export function getPriorityLabel(priority: LawyerPriority) { return priority === "high" ? "Высокий" : priority === "medium" ? "Средний" : "Плановый"; }
