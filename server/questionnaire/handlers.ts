import "server-only";

import type { SessionProvider } from "@/server/auth/contracts";
import {
  completeQuestionnaire,
  completeQuestionnaireSection,
  getOrCreateQuestionnaireForClient,
  getQuestionnaire,
  saveQuestionnaireAnswer,
} from "@/server/questionnaire/operations";
import {
  parseClientCaseId,
  parseCompleteQuestionnaireInput,
  parseCompleteQuestionnaireSectionInput,
  parseSaveQuestionnaireAnswerInput,
} from "@/server/questionnaire/input";
import { executeQuestionnaireOperation } from "@/server/questionnaire/transport";

export function handleGetQuestionnaire(sessionProvider: SessionProvider, clientCaseId: unknown) {
  return executeQuestionnaireOperation(() =>
    getQuestionnaire(sessionProvider, parseClientCaseId(clientCaseId)),
  );
}

export function handleGetOrCreateQuestionnaire(
  sessionProvider: SessionProvider,
  clientCaseId: unknown,
) {
  return executeQuestionnaireOperation(() =>
    getOrCreateQuestionnaireForClient(sessionProvider, parseClientCaseId(clientCaseId)),
  );
}

export function handleSaveQuestionnaireAnswer(
  sessionProvider: SessionProvider,
  input: unknown,
) {
  return executeQuestionnaireOperation(() =>
    saveQuestionnaireAnswer(sessionProvider, parseSaveQuestionnaireAnswerInput(input)),
  );
}

export function handleCompleteQuestionnaireSection(
  sessionProvider: SessionProvider,
  input: unknown,
) {
  return executeQuestionnaireOperation(() =>
    completeQuestionnaireSection(sessionProvider, parseCompleteQuestionnaireSectionInput(input)),
  );
}

export function handleCompleteQuestionnaire(
  sessionProvider: SessionProvider,
  input: unknown,
) {
  return executeQuestionnaireOperation(() =>
    completeQuestionnaire(sessionProvider, parseCompleteQuestionnaireInput(input)),
  );
}
