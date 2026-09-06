import "server-only";

import { randomUUID } from "node:crypto";
import { getPrismaClient } from "@/server/database/prisma";
import type {
  ClaimedStoredFileDeletion,
  StoredFileDeletionRecord,
  StoredFileDeletionRepository,
} from "@/server/domain/files/deletion-contracts";
import { buildCaseActivityWrite } from "@/server/repositories/prisma/case-activity-write";

function toRecord(row: StoredFileDeletionRecord): StoredFileDeletionRecord {
  return row;
}

export class PrismaStoredFileDeletionRepository implements StoredFileDeletionRepository {
  async getByFileId(fileId: string) {
    const prisma = getPrismaClient();
    const row = await prisma.storedFileDeletion.findUnique({ where: { fileId } });
    return row ? toRecord(row) : null;
  }

  async claimDueDeletion(input: { now: Date; leaseUntil: Date }) {
    const prisma = getPrismaClient();
    const eligible = {
      OR: [
        {
          status: "PENDING" as const,
          nextAttemptAt: { lte: input.now },
        },
        {
          status: "PROCESSING" as const,
          leaseUntil: { lte: input.now },
        },
      ],
    };

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = await prisma.storedFileDeletion.findFirst({
        where: eligible,
        orderBy: [{ nextAttemptAt: "asc" }, { requestedAt: "asc" }],
        select: { fileId: true },
      });
      if (!candidate) return null;

      const leaseToken = randomUUID();
      const claimed = await prisma.storedFileDeletion.updateMany({
        where: { fileId: candidate.fileId, ...eligible },
        data: {
          status: "PROCESSING",
          leaseUntil: input.leaseUntil,
          leaseToken,
          attemptCount: { increment: 1 },
          lastErrorCode: null,
        },
      });
      if (claimed.count !== 1) continue;

      const row = await prisma.storedFileDeletion.findUnique({
        where: { fileId: candidate.fileId },
      });
      if (!row || row.status !== "PROCESSING" || row.leaseToken !== leaseToken) continue;

      return toRecord(row) as ClaimedStoredFileDeletion;
    }

    return null;
  }

  async rescheduleDeletion(input: {
    fileId: string;
    leaseToken: string;
    nextAttemptAt: Date;
    errorCode: string;
  }) {
    const prisma = getPrismaClient();
    const updated = await prisma.storedFileDeletion.updateMany({
      where: {
        fileId: input.fileId,
        status: "PROCESSING",
        leaseToken: input.leaseToken,
      },
      data: {
        status: "PENDING",
        nextAttemptAt: input.nextAttemptAt,
        leaseUntil: null,
        leaseToken: null,
        lastErrorCode: input.errorCode,
      },
    });
    return updated.count === 1;
  }

  async markDeletionRequiresAttention(input: {
    fileId: string;
    leaseToken: string;
    errorCode: string;
  }) {
    const prisma = getPrismaClient();
    const updated = await prisma.storedFileDeletion.updateMany({
      where: {
        fileId: input.fileId,
        status: "PROCESSING",
        leaseToken: input.leaseToken,
      },
      data: {
        status: "REQUIRES_ATTENTION",
        nextAttemptAt: null,
        leaseUntil: null,
        leaseToken: null,
        lastErrorCode: input.errorCode,
      },
    });
    return updated.count === 1;
  }

  async finalizeDeletion(input: {
    fileId: string;
    leaseToken: string;
    storageConfirmedAt: Date;
    completedAt: Date;
  }) {
    const prisma = getPrismaClient();
    return prisma.$transaction(async (tx) => {
      const current = await tx.storedFileDeletion.findUnique({
        where: { fileId: input.fileId },
      });
      if (
        !current ||
        current.status !== "PROCESSING" ||
        current.leaseToken !== input.leaseToken
      ) {
        return false;
      }

      const completed = await tx.storedFileDeletion.updateMany({
        where: {
          fileId: input.fileId,
          status: "PROCESSING",
          leaseToken: input.leaseToken,
        },
        data: {
          status: "COMPLETED",
          storageConfirmedAt: input.storageConfirmedAt,
          completedAt: input.completedAt,
          nextAttemptAt: null,
          leaseUntil: null,
          leaseToken: null,
          lastErrorCode: null,
        },
      });
      if (completed.count !== 1) return false;

      const event = await tx.caseActivityEvent.create({
        data: buildCaseActivityWrite({
          clientCaseId: current.clientCaseId,
          actorUserId: current.requestedByUserId,
          type: "file.deleted",
          metadata: {
            fileId: current.fileId,
            storageProvider: current.storageProvider,
            fileStatus: current.originalFileStatus,
          },
        }),
      });

      await tx.storedFileDeletion.update({
        where: { fileId: current.fileId },
        data: { completionActivityEventId: event.id },
      });
      return true;
    });
  }
}
