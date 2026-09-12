import type { AiContext, ClientDashboardData, DemoClientCase, DemoIdentity, GeneratedDocument } from "../types";

type BuildAiContextInput = {
  identity: DemoIdentity;
  clientCase: DemoClientCase;
  dashboard: ClientDashboardData;
  practicumProgress: number;
  questionnaireProgress: number;
  documents: readonly GeneratedDocument[];
};

const FEATURES = ["Практикум", "Анкета", "Документы", "AI-помощник", "Персональный анализ ипотечного жилья"] as const;

export function buildAiContext(input: BuildAiContextInput): AiContext {
  const ready = input.documents.filter((document) => ["ready_for_review", "reviewed", "sent_for_review"].includes(document.status));
  return {
    identityId: input.identity.id,
    displayName: input.identity.displayName,
    firstName: input.identity.displayName.split(" ")[0] ?? input.identity.displayName,
    plan: input.clientCase.plan,
    caseNumber: input.clientCase.caseNumber,
    currentStage: input.clientCase.stage,
    overallProgress: input.clientCase.progress,
    nextStep: input.dashboard.nextStep.title,
    practicumProgress: input.practicumProgress,
    questionnaireProgress: input.questionnaireProgress,
    documents: {
      readyCount: ready.length,
      draftCount: input.documents.filter((document) => document.status === "draft").length,
      waitingCount: input.documents.filter((document) => document.status === "waiting_data").length,
      readyTitles: ready.map((document) => document.definition.title),
    },
    assignedLawyer: input.clientCase.assignedLawyer,
    availableFeatures: FEATURES,
  };
}
