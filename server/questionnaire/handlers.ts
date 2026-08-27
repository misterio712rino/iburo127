import "server-only";

import type { QuestionnaireAnswer } from "@/lib/platform/types";
import type { SessionProvider } from "@/server/auth/contracts";
import {
  completeQuestionnaire,
  completeQuestionnaireSection,
  getOrCreateQuestionnaireForClient,
  getQuestionnaire,
  saveQuestionnaireAnswer,
} from "@/server/questionnaire/operations";
import { executeQuestionnaireOperation } from "@/server/questionnaire/transport";

export function handleGetQuestionnaire(sessionProvider: SessionProvider, clientCaseId: string) {
  return executeQuestionnaireOperation(() => getQuestionnaire(sessionProvider, clientCaseId));
}

export function handleGetOrCreateQuestionnaire(
  sessionProvider: SessionProvider,
  clientCaseId: string,
) {
  return executeQuestionnaireOperation(() =>
    getOrCreateQuestionnaireForClient(sessionProvider, clientCaseId),
  );
}

export function handleSaveQuestionnaireAnswer(
  sessionProvider: SessionProvider,
  input: {
    clientCaseId: string;
    fieldId: string;
    value: QuestionnaireAnswer;
    expectedVersion?: number;
  },
) {
  return executeQuestionnaireOperation(() => saveQuestionnaireAnswer(sessionProvider, input));
}

export function handleCompleteQuestionnaireSection(
  sessionProvider: SessionProvider,
  input: {
    clientCaseId: string;
    sectionId: string;
    expectedVersion?: number;
  },
) {
  return executeQuestionnaireOperation(() => completeQuestionnaireSection(sessionProvider, input));
}

export function handleCompleteQuestionnaire(
  sessionProvider: SessionProvider,
  input: {
    clientCaseId: string;
    expectedVersion?: number;
  },
) {
  return executeQuestionnaireOperation(() => completeQuestionnaire(sessionProvider, input));
}
