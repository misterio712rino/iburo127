import "server-only";

import type { QuestionnaireAnswers } from "@/lib/platform/types";
import { getPrismaClient } from "@/server/database/prisma";
import {
  QUESTIONNAIRE_NOT_FOUND,
  QUESTIONNAIRE_VERSION_CONFLICT,
  type CompleteQuestionnaireInput,
  type CompleteQuestionnaireSectionInput,
  type QuestionnaireRecord,
  type QuestionnaireRepository,
  type SaveQuestionnaireAnswerInput,
} from "@/server/domain/questionnaire/contracts";

function normalizeAnswers(value: unknown): QuestionnaireAnswers {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const answers: QuestionnaireAnswers = {};
  for (const [fieldId, answer] of Object.entries(value)) {
    if (typeof answer === "string" || typeof answer === "number" || typeof answer === "boolean") {
      answers[fieldId] = answer;
    }
  }
  return answers;
}

function toRecord(row: {
  clientCaseId: string;
  schemaVersion: number;
  status: QuestionnaireRecord["status"];
  answers: unknown;
  completedSectionIds: string[];
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}): QuestionnaireRecord {
  return {
    clientCaseId: row.clientCaseId,
    schemaVersion: row.schemaVersion,
    status: row.status,
    answers: normalizeAnswers(row.answers),
    completedSectionIds: row.completedSectionIds,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    version: row.version,
  };
}

export class PrismaQuestionnaireRepository implements QuestionnaireRepository {
  async getByClientCaseId(clientCaseId: string): Promise<QuestionnaireRecord | null> {
    const prisma = getPrismaClient();
    const row = await prisma.caseQuestionnaire.findUnique({ where: { clientCaseId } });
    return row ? toRecord(row) : null;
  }

  async createForCase(clientCaseId: string, schemaVersion: number): Promise<QuestionnaireRecord> {
    const prisma = getPrismaClient();
    const row = await prisma.caseQuestionnaire.create({
      data: {
        clientCaseId,
        schemaVersion,
        answers: {},
        completedSectionIds: [],
      },
    });
    return toRecord(row);
  }

  async saveAnswer(input: SaveQuestionnaireAnswerInput): Promise<QuestionnaireRecord> {
    const prisma = getPrismaClient();

    return prisma.$transaction(async (tx) => {
      const current = await tx.caseQuestionnaire.findUnique({ where: { clientCaseId: input.clientCaseId } });
      if (!current) throw new Error(QUESTIONNAIRE_NOT_FOUND);

      const invalidated = new Set(input.invalidatedSectionIds ?? []);
      const completedSectionIds = current.completedSectionIds.filter(
        (sectionId) => !invalidated.has(sectionId),
      );

      const updated = await tx.caseQuestionnaire.updateMany({
        where: {
          clientCaseId: input.clientCaseId,
          version: input.expectedVersion,
        },
        data: {
          answers: {
            ...normalizeAnswers(current.answers),
            [input.fieldId]: input.value,
          },
          completedSectionIds,
          status: current.status === "COMPLETED" ? "COMPLETED" : "IN_PROGRESS",
          startedAt: current.startedAt ?? new Date(),
          version: { increment: 1 },
        },
      });

      if (updated.count !== 1) throw new Error(QUESTIONNAIRE_VERSION_CONFLICT);

      const row = await tx.caseQuestionnaire.findUnique({ where: { clientCaseId: input.clientCaseId } });
      if (!row) throw new Error(QUESTIONNAIRE_NOT_FOUND);
      return toRecord(row);
    });
  }

  async completeSection(input: CompleteQuestionnaireSectionInput): Promise<QuestionnaireRecord> {
    const prisma = getPrismaClient();

    return prisma.$transaction(async (tx) => {
      const current = await tx.caseQuestionnaire.findUnique({ where: { clientCaseId: input.clientCaseId } });
      if (!current) throw new Error(QUESTIONNAIRE_NOT_FOUND);

      const completedSectionIds = current.completedSectionIds.includes(input.sectionId)
        ? current.completedSectionIds
        : [...current.completedSectionIds, input.sectionId];

      const updated = await tx.caseQuestionnaire.updateMany({
        where: {
          clientCaseId: input.clientCaseId,
          version: input.expectedVersion,
        },
        data: {
          completedSectionIds,
          status: current.status === "COMPLETED" ? "COMPLETED" : "IN_PROGRESS",
          startedAt: current.startedAt ?? new Date(),
          version: { increment: 1 },
        },
      });

      if (updated.count !== 1) throw new Error(QUESTIONNAIRE_VERSION_CONFLICT);

      const row = await tx.caseQuestionnaire.findUnique({ where: { clientCaseId: input.clientCaseId } });
      if (!row) throw new Error(QUESTIONNAIRE_NOT_FOUND);
      return toRecord(row);
    });
  }

  async markCompleted(input: CompleteQuestionnaireInput): Promise<QuestionnaireRecord> {
    const prisma = getPrismaClient();

    return prisma.$transaction(async (tx) => {
      const current = await tx.caseQuestionnaire.findUnique({ where: { clientCaseId: input.clientCaseId } });
      if (!current) throw new Error(QUESTIONNAIRE_NOT_FOUND);

      const updated = await tx.caseQuestionnaire.updateMany({
        where: {
          clientCaseId: input.clientCaseId,
          version: input.expectedVersion,
        },
        data: {
          status: "COMPLETED",
          startedAt: current.startedAt ?? new Date(),
          completedAt: current.completedAt ?? new Date(),
          version: { increment: 1 },
        },
      });

      if (updated.count !== 1) throw new Error(QUESTIONNAIRE_VERSION_CONFLICT);

      const row = await tx.caseQuestionnaire.findUnique({ where: { clientCaseId: input.clientCaseId } });
      if (!row) throw new Error(QUESTIONNAIRE_NOT_FOUND);
      return toRecord(row);
    });
  }
}
