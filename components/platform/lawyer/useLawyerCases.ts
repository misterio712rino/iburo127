"use client";

import { useDocumentState } from "@/components/platform/documents/useDocumentState";
import { usePracticumProgress } from "@/components/platform/practicum/usePracticumProgress";
import { useQuestionnaireState } from "@/components/platform/questionnaire/useQuestionnaireState";
import { DEMO_CASES, DEMO_IDENTITIES, deriveLawyerCase, generateDocuments, getQuestionnaireSummary } from "@/lib/platform/demo";

function useOperationalCase(identityId: string) {
  const practicum = usePracticumProgress(identityId);
  const questionnaire = useQuestionnaireState(identityId);
  const documentState = useDocumentState(identityId);
  const identity = DEMO_IDENTITIES.find((item) => item.id === identityId)!;
  const clientCase = DEMO_CASES.find((item) => item.clientId === identityId)!;
  const documents = generateDocuments(identityId, getQuestionnaireSummary(questionnaire.answers), documentState.state);
  return { summary: deriveLawyerCase(identity, clientCase, { practicum: { completedCount: practicum.completedCount, progress: practicum.progress, currentLessonTitle: practicum.currentLesson?.title }, questionnaire: { completedCount: questionnaire.completedCount, progress: questionnaire.progress, currentSectionTitle: questionnaire.currentSection.title, isComplete: questionnaire.isComplete }, documents }), markReviewed: documentState.markReviewed };
}

export function useLawyerCases() {
  const alexander = useOperationalCase("alexander-lite");
  const maria = useOperationalCase("maria-pro");
  const dmitry = useOperationalCase("dmitry-individual");
  return [alexander, maria, dmitry] as const;
}
