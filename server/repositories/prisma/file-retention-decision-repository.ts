import "server-only";

import { randomUUID } from "node:crypto";
import { getPrismaClient } from "@/server/database/prisma";
import type {
  FileRetentionDecisionRepository,
  RetentionCase,
  RetentionDecision,
} from "@/server/domain/files/retention-decision-service";
import type {
  ClaimedFileRetentionDecision,
  FileRetentionDecisionProcessResult,
  FileRetentionWorkerRepository,
} from "@/server/domain/files/retention-worker";

const UPLOAD_URL_GRACE_MS = 10 * 60 * 1000;
const RETENTION_QUEUE_BATCH_SIZE = 100;

const decisionSelect = {
  clientCaseId: true,
  requestedByUserId: true,
  choice: true,
  policyVersion: true,
  procedureCompletedAt: true,
  deleteAt: true,
  decidedAt: true,
} as const;

export class PrismaFileRetentionDecisionRepository
  implements FileRetentionDecisionRepository, FileRetentionWorkerRepository
{
  async findCase(clientCaseId: string): Promise<RetentionCase | null> {
    const prisma = getPrismaClient();
    return prisma.clientCase.findUnique({
      where: { id: clientCaseId },
      select: { id: true, clientId: true, status: true, closedAt: true },
    });
  }

  async findDecision(clientCaseId: string): Promise<RetentionDecision | null> {
    const prisma = getPrismaClient();
    return prisma.clientCaseFileRetentionDecision.findUnique({
      where: { clientCaseId },
      select: decisionSelect,
    });
  }

  async saveDecision(decision: RetentionDecision): Promise<RetentionDecision> {
    const prisma = getPrismaClient();
    return prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "ClientCase" WHERE "id" = ${decision.clientCaseId}::uuid FOR UPDATE
      `;
      if (locked.length !== 1) throw new Error("FILE_RETENTION_CASE_NOT_FOUND");

      return tx.clientCaseFileRetentionDecision.upsert({
        where: { clientCaseId: decision.clientCaseId },
        create: decision,
        update: {},
        select: decisionSelect,
      });
    });
  }

  async claimDueDecision(input: { now: Date; leaseUntil: Date }) {
    const prisma = getPrismaClient();
    const eligible = {
      deleteAt: { lte: input.now },
      OR: [
        { status: "PENDING" as const, nextAttemptAt: { lte: input.now } },
        { status: "PROCESSING" as const, leaseUntil: { lte: input.now } },
      ],
    };

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = await prisma.clientCaseFileRetentionDecision.findFirst({
        where: eligible,
        orderBy: [{ deleteAt: "asc" }, { nextAttemptAt: "asc" }],
        select: { clientCaseId: true },
      });
      if (!candidate) return null;

      const leaseToken = randomUUID();
      const claimed = await prisma.clientCaseFileRetentionDecision.updateMany({
        where: { clientCaseId: candidate.clientCaseId, ...eligible },
        data: {
          status: "PROCESSING",
          leaseUntil: input.leaseUntil,
          leaseToken,
          attemptCount: { increment: 1 },
          lastErrorCode: null,
        },
      });
      if (claimed.count !== 1) continue;

      const row = await prisma.clientCaseFileRetentionDecision.findUnique({
        where: { clientCaseId: candidate.clientCaseId },
        select: { ...decisionSelect, attemptCount: true, leaseToken: true },
      });
      if (!row || row.leaseToken !== leaseToken) continue;
      return row as ClaimedFileRetentionDecision;
    }
    return null;
  }

  async processClaimedDecision(input: {
    clientCaseId: string;
    leaseToken: string;
    now: Date;
  }): Promise<FileRetentionDecisionProcessResult> {
    const prisma = getPrismaClient();
    return prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "ClientCase" WHERE "id" = ${input.clientCaseId}::uuid FOR UPDATE
      `;
      if (locked.length !== 1) throw new Error("FILE_RETENTION_CASE_NOT_FOUND");

      const decision = await tx.clientCaseFileRetentionDecision.findUnique({
        where: { clientCaseId: input.clientCaseId },
        select: { status: true, leaseToken: true },
      });
      if (
        !decision ||
        decision.status !== "PROCESSING" ||
        decision.leaseToken !== input.leaseToken
      ) return "LEASE_LOST";

      const clientCase = await tx.clientCase.findUnique({
        where: { id: input.clientCaseId },
        select: { clientId: true },
      });
      if (!clientCase) throw new Error("FILE_RETENTION_CASE_NOT_FOUND");

      const uploadGraceCutoff = new Date(input.now.getTime() - UPLOAD_URL_GRACE_MS);
      const files = await tx.storedFile.findMany({
        where: {
          clientCaseId: input.clientCaseId,
          AND: [
            { status: { not: "SCANNING" } },
            {
              OR: [
                { status: { not: "PENDING_UPLOAD" } },
                { status: "PENDING_UPLOAD", createdAt: { lte: uploadGraceCutoff } },
              ],
            },
          ],
        },
        orderBy: { createdAt: "asc" },
        take: RETENTION_QUEUE_BATCH_SIZE,
      });

      for (const file of files) {
        const removed = await tx.storedFile.deleteMany({
          where: {
            id: file.id,
            clientCaseId: input.clientCaseId,
            status: file.status,
          },
        });
        if (removed.count !== 1) continue;

        await tx.storedFileDeletion.create({
          data: {
            fileId: file.id,
            clientCaseId: file.clientCaseId,
            requestedByUserId: clientCase.clientId,
            storageProvider: file.storageProvider,
            objectKey: file.objectKey,
            originalFileStatus: file.status,
            status: "PENDING",
            attemptCount: 0,
            nextAttemptAt: input.now,
            requestedAt: input.now,
          },
        });
      }

      const remainingFiles = await tx.storedFile.count({
        where: { clientCaseId: input.clientCaseId },
      });
      if (remainingFiles > 0) return "WAITING_FOR_FILE_DELETIONS";

      const deletionStates = await tx.storedFileDeletion.groupBy({
        by: ["status"],
        where: { clientCaseId: input.clientCaseId },
        _count: { _all: true },
      });
      if (deletionStates.some((row) => row.status === "REQUIRES_ATTENTION")) {
        await tx.clientCaseFileRetentionDecision.updateMany({
          where: {
            clientCaseId: input.clientCaseId,
            status: "PROCESSING",
            leaseToken: input.leaseToken,
          },
          data: {
            status: "REQUIRES_ATTENTION",
            leaseUntil: null,
            leaseToken: null,
            lastErrorCode: "FILE_RETENTION_FILE_DELETION_REQUIRES_ATTENTION",
          },
        });
        return "REQUIRES_ATTENTION";
      }

      const outstandingDeletion = deletionStates.some(
        (row) => row.status !== "COMPLETED" && row._count._all > 0,
      );
      if (outstandingDeletion) return "WAITING_FOR_FILE_DELETIONS";

      // Purge extracted answers and generated-document source payloads only
      // after every uploaded object has a durable, confirmed storage deletion.
      await tx.caseDocumentRevision.deleteMany({
        where: { caseDocument: { is: { clientCaseId: input.clientCaseId } } },
      });
      await tx.caseQuestionnaire.deleteMany({
        where: { clientCaseId: input.clientCaseId },
      });

      const completed = await tx.clientCaseFileRetentionDecision.updateMany({
        where: {
          clientCaseId: input.clientCaseId,
          status: "PROCESSING",
          leaseToken: input.leaseToken,
        },
        data: {
          status: "COMPLETED",
          completedAt: input.now,
            leaseUntil: null,
          leaseToken: null,
          lastErrorCode: null,
        },
      });
      return completed.count === 1 ? "COMPLETED" : "LEASE_LOST";
    });
  }

  async rescheduleDecision(input: {
    clientCaseId: string;
    leaseToken: string;
    nextAttemptAt: Date;
    errorCode: string;
  }) {
    const prisma = getPrismaClient();
    const updated = await prisma.clientCaseFileRetentionDecision.updateMany({
      where: {
        clientCaseId: input.clientCaseId,
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

  async markDecisionRequiresAttention(input: {
    clientCaseId: string;
    leaseToken: string;
    errorCode: string;
  }) {
    const prisma = getPrismaClient();
    const updated = await prisma.clientCaseFileRetentionDecision.updateMany({
      where: {
        clientCaseId: input.clientCaseId,
        status: "PROCESSING",
        leaseToken: input.leaseToken,
      },
      data: {
        status: "REQUIRES_ATTENTION",
        leaseUntil: null,
        leaseToken: null,
        lastErrorCode: input.errorCode,
      },
    });
    return updated.count === 1;
  }
}
