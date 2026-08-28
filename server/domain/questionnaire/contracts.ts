import type { QuestionnaireAnswer, QuestionnaireAnswers } from "@/lib/platform/types";

export const QUESTIONNAIRE_NOT_FOUND = "QUESTIONNAIRE_NOT_FOUND";
export const QUESTIONNAIRE_VERSION_CONFLICT = "QUESTIONNAIRE_VERSION_CONFLICT";

export type QuestionnaireStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";

export type QuestionnaireRecord = {
  clientCaseId: string;
  schemaVersion: number;
  status: QuestionnaireStatus;
  answers: QuestionnaireAnswers;
  completedSectionIds: readonly string[];
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
};

export type SaveQuestionnaireAnswerInput = {
  clientCaseId: string;
  fieldId: string;
  value: QuestionnaireAnswer;
  expectedVersion: number;
  invalidatedSectionIds?: readonly string[];
  auditActorUserId: string;
};

export type CompleteQuestionnaireSectionInput = {
  clientCaseId: string;
  sectionId: string;
  expectedVersion: number;
  auditActorUserId: string;
};

export type CompleteQuestionnaireInput = {
  clientCaseId: string;
  expectedVersion: number;
  auditActorUserId: string;
};

export interface QuestionnaireRepository {
  getByClientCaseId(clientCaseId: string): Promise<QuestionnaireRecord | null>;
  createForCase(
    clientCaseId: string,
    schemaVersion: number,
    auditActorUserId: string,
  ): Promise<QuestionnaireRecord>;
  saveAnswer(input: SaveQuestionnaireAnswerInput): Promise<QuestionnaireRecord>;
  completeSection(input: CompleteQuestionnaireSectionInput): Promise<QuestionnaireRecord>;
  markCompleted(input: CompleteQuestionnaireInput): Promise<QuestionnaireRecord>;
}
