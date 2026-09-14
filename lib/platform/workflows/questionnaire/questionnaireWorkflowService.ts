import type { QuestionnaireAnswer, QuestionnaireAnswers } from "@/lib/platform/types";
import {
  getQuestionnaireServerSnapshot,
  persistQuestionnaireState,
  readQuestionnaireState,
  subscribeQuestionnaireState,
  type QuestionnaireStoredState,
} from "@/lib/platform/workflows/questionnaire/demoQuestionnaireAdapter";

export interface QuestionnaireWorkflowService {
  read(identityId: string): QuestionnaireStoredState;
  getServerSnapshot(identityId: string): string;
  subscribe(callback: () => void): () => void;
  start(identityId: string, state: QuestionnaireStoredState): void;
  setAnswer(
    identityId: string,
    state: QuestionnaireStoredState,
    fieldId: string,
    value: QuestionnaireAnswer,
  ): void;
  completeSection(
    identityId: string,
    state: QuestionnaireStoredState,
    completedSectionIds: readonly string[],
  ): void;
}

class DemoQuestionnaireWorkflowService implements QuestionnaireWorkflowService {
  read(identityId: string) {
    return readQuestionnaireState(identityId);
  }

  getServerSnapshot(identityId: string) {
    return getQuestionnaireServerSnapshot(identityId);
  }

  subscribe(callback: () => void) {
    return subscribeQuestionnaireState(callback);
  }

  start(identityId: string, state: QuestionnaireStoredState) {
    persistQuestionnaireState(identityId, { ...state, started: true });
  }

  setAnswer(
    identityId: string,
    state: QuestionnaireStoredState,
    fieldId: string,
    value: QuestionnaireAnswer,
  ) {
    const answers: QuestionnaireAnswers = { ...state.answers, [fieldId]: value };
    persistQuestionnaireState(identityId, { ...state, started: true, answers });
  }

  completeSection(
    identityId: string,
    state: QuestionnaireStoredState,
    completedSectionIds: readonly string[],
  ) {
    persistQuestionnaireState(identityId, {
      ...state,
      started: true,
      completedSectionIds: [...completedSectionIds],
    });
  }
}

export const questionnaireWorkflowService: QuestionnaireWorkflowService =
  new DemoQuestionnaireWorkflowService();

export type { QuestionnaireStoredState };
