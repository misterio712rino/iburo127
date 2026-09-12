import "server-only";

import type { QuestionnaireAnswer } from "@/lib/platform/types";
import type { SessionProvider } from "@/server/auth/contracts";
import { requireServerActor } from "@/server/auth/runtime";
import { questionnaireService } from "@/server/questionnaire/runtime";

export async function getQuestionnaire(
  sessionProvider: SessionProvider,
  clientCaseId: string,
) {
  const actor = await requireServerActor(sessionProvider);
  return questionnaireService.get(actor, clientCaseId);
}

export async function getOrCreateQuestionnaireForClient(
  sessionProvider: SessionProvider,
  clientCaseId: string,
) {
  const actor = await requireServerActor(sessionProvider);
  return questionnaireService.getOrCreateForClient(actor, clientCaseId);
}

export async function saveQuestionnaireAnswer(
  sessionProvider: SessionProvider,
  input: {
    clientCaseId: string;
    fieldId: string;
    value: QuestionnaireAnswer;
    expectedVersion: number;
  },
) {
  const actor = await requireServerActor(sessionProvider);
  return questionnaireService.saveAnswer(actor, input);
}

export async function completeQuestionnaireSection(
  sessionProvider: SessionProvider,
  input: {
    clientCaseId: string;
    sectionId: string;
    expectedVersion: number;
  },
) {
  const actor = await requireServerActor(sessionProvider);
  return questionnaireService.completeSection(actor, input);
}

export async function completeQuestionnaire(
  sessionProvider: SessionProvider,
  input: {
    clientCaseId: string;
    expectedVersion: number;
  },
) {
  const actor = await requireServerActor(sessionProvider);
  return questionnaireService.markCompleted(actor, input);
}
