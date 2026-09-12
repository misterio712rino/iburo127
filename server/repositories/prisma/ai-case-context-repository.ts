import "server-only";

import { getPrismaClient } from "@/server/database/prisma";
import type {
  AiCaseContext,
  AiCaseContextRepository,
} from "@/server/domain/ai/contracts";

export class PrismaAiCaseContextRepository implements AiCaseContextRepository {
  async loadCaseContext(clientCaseId: string): Promise<AiCaseContext | null> {
    const prisma = getPrismaClient();
    const clientCase = await prisma.clientCase.findUnique({
      where: { id: clientCaseId },
      select: {
        status: true,
        plan: {
          select: {
            code: true,
            features: {
              select: { feature: { select: { code: true } } },
            },
          },
        },
        stage: { select: { code: true } },
        questionnaire: {
          select: { status: true, completedSectionIds: true },
        },
        practicumProgress: {
          select: { status: true, completedLessonIds: true },
        },
        documents: {
          select: { documentCode: true, status: true },
          orderBy: { documentCode: "asc" },
        },
        storedFiles: {
          where: { status: "READY" },
          select: { id: true },
        },
      },
    });

    if (!clientCase) return null;

    return {
      planCode: clientCase.plan.code,
      stageCode: clientCase.stage.code,
      caseStatus: clientCase.status,
      questionnaireStatus: clientCase.questionnaire?.status ?? null,
      questionnaireCompletedSections:
        clientCase.questionnaire?.completedSectionIds.length ?? 0,
      practicumStatus: clientCase.practicumProgress?.status ?? null,
      practicumCompletedLessons:
        clientCase.practicumProgress?.completedLessonIds.length ?? 0,
      documents: clientCase.documents.map((document) => ({
        code: document.documentCode,
        status: document.status,
      })),
      readyFileCount: clientCase.storedFiles.length,
      featureCodes: clientCase.plan.features.map(({ feature }) => feature.code),
    };
  }
}
