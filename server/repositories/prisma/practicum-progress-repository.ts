import "server-only";

import { getPrismaClient } from "@/server/database/prisma";
import {
  PRACTICUM_NOT_FOUND,
  PRACTICUM_VERSION_CONFLICT,
  type PracticumProgressRecord,
  type PracticumProgressRepository,
} from "@/server/domain/practicum/contracts";
import { buildCaseActivityWrite } from "@/server/repositories/prisma/case-activity-write";
import { createCaseNotificationInTransaction } from "@/server/repositories/prisma/case-notification-write";
import { isPrismaUniqueConstraintError } from "@/server/repositories/prisma/errors";

const HUMAN_SUPPORT_PLAN_CODES = ["PRO", "INDIVIDUAL"] as const;

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
    try {
      const row = await prisma.casePracticumProgress.create({
        data: { clientCaseId, completedLessonIds: [] },
      });
      return toRecord(row);
    } catch (error) {
      if (!isPrismaUniqueConstraintError(error)) throw error;
      const existing = await prisma.casePracticumProgress.findUnique({ where: { clientCaseId } });
      if (!existing) throw error;
      return toRecord(existing);
    }
  }

  async completeLesson(input: {
    clientCaseId: string;
    lessonId: string;
    expectedVersion: number;
    isFinalLesson?: boolean;
    auditActorUserId: string;
  }) {
    const prisma = getPrismaClient();

    return prisma.$transaction(async (tx) => {
      const current = await tx.casePracticumProgress.findFirst({
        where: {
          clientCaseId: input.clientCaseId,
          clientCase: { clientId: input.auditActorUserId },
        },
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
          clientCase: { clientId: input.auditActorUserId },
        },
        data: {
          completedLessonIds,
          startedAt: current.startedAt ?? now,
          completedAt: input.isFinalLesson ? current.completedAt ?? now : current.completedAt,
          version: { increment: 1 },
        },
      });

      if (updated.count !== 1) throw new Error(PRACTICUM_VERSION_CONFLICT);

      await tx.caseActivityEvent.create({
        data: buildCaseActivityWrite({
          clientCaseId: input.clientCaseId,
          actorUserId: input.auditActorUserId,
          type: "practicum.lesson.completed",
          metadata: { lessonId: input.lessonId },
        }),
      });
      if (input.isFinalLesson) {
        await tx.caseActivityEvent.create({
          data: buildCaseActivityWrite({
            clientCaseId: input.clientCaseId,
            actorUserId: input.auditActorUserId,
            type: "practicum.completed",
            metadata: { lessonId: input.lessonId },
          }),
        });

        const clientCase = await tx.clientCase.findFirst({
          where: {
            id: input.clientCaseId,
            clientId: input.auditActorUserId,
            assignedLawyerId: { not: null },
            plan: { code: { in: [...HUMAN_SUPPORT_PLAN_CODES] } },
          },
          select: { caseNumber: true, assignedLawyerId: true },
        });
        if (clientCase?.assignedLawyerId) {
          await createCaseNotificationInTransaction(tx, {
            userId: clientCase.assignedLawyerId,
            clientCaseId: input.clientCaseId,
            dedupeKey: `practicum.completed:${input.clientCaseId}`,
            type: "practicum.completed",
            title: "Практикум завершён",
            body: `Клиент по делу ${clientCase.caseNumber} завершил практикум.`,
          });
        }
      }

      const row = await tx.casePracticumProgress.findFirst({
        where: {
          clientCaseId: input.clientCaseId,
          clientCase: { clientId: input.auditActorUserId },
        },
      });
      if (!row) throw new Error(PRACTICUM_NOT_FOUND);
      return toRecord(row);
    });
  }
}
