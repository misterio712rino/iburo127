import "server-only";

import { getPrismaClient } from "@/server/database/prisma";
import {
  PRACTICUM_NOT_FOUND,
  PRACTICUM_VERSION_CONFLICT,
  type PracticumProgressRecord,
  type PracticumProgressRepository,
} from "@/server/domain/practicum/contracts";

function toRecord(row: {
  clientCaseId: string;
  completedLessonIds: string[];
  startedAt: Date | null;
  completedAt: Date | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}): PracticumProgressRecord {
  return row;
}

export class PrismaPracticumProgressRepository implements PracticumProgressRepository {
  async getByClientCaseId(clientCaseId: string) {
    const prisma = getPrismaClient();
    const row = await prisma.casePracticumProgress.findUnique({ where: { clientCaseId } });
    return row ? toRecord(row) : null;
  }

  async createForCase(clientCaseId: string) {
    const prisma = getPrismaClient();
    const row = await prisma.casePracticumProgress.create({
      data: { clientCaseId, completedLessonIds: [] },
    });
    return toRecord(row);
  }

  async completeLesson(input: {
    clientCaseId: string;
    lessonId: string;
    expectedVersion: number;
    isFinalLesson?: boolean;
  }) {
    const prisma = getPrismaClient();

    return prisma.$transaction(async (tx) => {
      const current = await tx.casePracticumProgress.findUnique({
        where: { clientCaseId: input.clientCaseId },
      });
      if (!current) throw new Error(PRACTICUM_NOT_FOUND);

      const completedLessonIds = current.completedLessonIds.includes(input.lessonId)
        ? current.completedLessonIds
        : [...current.completedLessonIds, input.lessonId];
      const now = new Date();

      const updated = await tx.casePracticumProgress.updateMany({
        where: {
          clientCaseId: input.clientCaseId,
          version: input.expectedVersion,
        },
        data: {
          completedLessonIds,
          startedAt: current.startedAt ?? now,
          completedAt: input.isFinalLesson ? current.completedAt ?? now : current.completedAt,
          version: { increment: 1 },
        },
      });

      if (updated.count !== 1) throw new Error(PRACTICUM_VERSION_CONFLICT);

      const row = await tx.casePracticumProgress.findUnique({
        where: { clientCaseId: input.clientCaseId },
      });
      if (!row) throw new Error(PRACTICUM_NOT_FOUND);
      return toRecord(row);
    });
  }
}
