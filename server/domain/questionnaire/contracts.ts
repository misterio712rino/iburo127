import type { QuestionnaireAnswer, QuestionnaireAnswers } from "@/lib/platform/types";

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
  expectedVersion?: number;
};

export type CompleteQuestionnaireSectionInput = {
  clientCaseId: string;
  sectionId: string;
  expectedVersion?: number;
};

export interface QuestionnaireRepository {
  getByClientCaseId(clientCaseId: string): Promise<QuestionnaireRecord | null>;
  createForCase(clientCaseId: string, schemaVersion: number): Promise<QuestionnaireRecord>;
  saveAnswer(input: SaveQuestionnaireAnswerInput): Promise<QuestionnaireRecord>;
  completeSection(input: CompleteQuestionnaireSectionInput): Promise<QuestionnaireRecord>;
}
