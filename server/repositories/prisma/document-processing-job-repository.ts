import "server-only";

import { randomUUID } from "node:crypto";
import { getPrismaClient } from "@/server/database/prisma";
import type {
  ClaimedDocumentProcessingJob,
  DocumentProcessingJobRepository,
} from "@/server/domain/documents/processing-worker";

const MAX_PAGES = 40;
const MAX_PAGE_TEXT_LENGTH = 500_000;

function isPageTexts(value: readonly string[], pageCount: number) {
  return Number.isInteger(pageCount) &&
    pageCount >= 1 &&
    pageCount <= MAX_PAGES &&
    value.length === pageCount &&
    value.every((page) => typeof page === "string" && !page.includes("\0")) &&
    value.reduce((sum, page) => sum + page.length, 0) <= MAX_PAGE_TEXT_LENGTH;
}

export class PrismaDocumentProcessingJobRepository implements DocumentProcessingJobRepository {
  async claimDue(input: { now: Date; leaseUntil: Date }) {
    const prisma = getPrismaClient();
    const eligible = {
      sourceFile: { is: { status: "READY" as const } },
      OR: [
        { status: "PENDING" as const, nextAttemptAt: { lte: input.now } },
        { status: "PROCESSING" as const, leaseUntil: { lte: input.now } },
      ],
    };

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = await prisma.documentProcessingJob.findFirst({
        where: eligible,
        orderBy: [{ nextAttemptAt: "asc" }, { createdAt: "asc" }],
        select: { id: true },
      });
      if (!candidate) return null;

      const leaseToken = randomUUID();
      const claimed = await prisma.documentProcessingJob.updateMany({
        where: { id: candidate.id, ...eligible },
        data: {
          status: "PROCESSING",
          leaseUntil: input.leaseUntil,
          leaseToken,
          attemptCount: { increment: 1 },
          lastErrorCode: null,
        },
      });
      if (claimed.count !== 1) continue;

      const row = await prisma.documentProcessingJob.findUnique({
        where: { id: candidate.id },
        include: {
          sourceFile: {
            select: {
              id: true,
              clientCaseId: true,
              status: true,
              storageProvider: true,
              objectKey: true,
              mimeType: true,
              sizeBytes: true,
            },
          },
        },
      });
      if (!row || row.status !== "PROCESSING" || row.leaseToken !== leaseToken) continue;

      return {
        id: row.id,
        clientCaseId: row.clientCaseId,
        sourceFile: row.sourceFile,
        attemptCount: row.attemptCount,
        leaseToken,
      } satisfies ClaimedDocumentProcessingJob;
    }

    return null;
  }

  async complete(input: Parameters<DocumentProcessingJobRepository["complete"]>[0]) {
    if (!isPageTexts(input.pageTexts, input.pageCount)) {
      throw new Error("DOCUMENT_PROCESSING_FAILED:INVALID_OCR_OUTPUT");
    }
    const prisma = getPrismaClient();
    const updated = await prisma.documentProcessingJob.updateMany({
      where: {
        id: input.jobId,
        status: "PROCESSING",
        leaseToken: input.leaseToken,
        sourceFile: { is: { status: "READY" } },
      },
      data: {
        status: "COMPLETED",
        pageTexts: [...input.pageTexts],
        pageCount: input.pageCount,
        completedAt: input.completedAt,
        failedAt: null,
        cancelledAt: null,
        lastErrorCode: null,
        leaseUntil: null,
        leaseToken: null,
      },
    });
    return updated.count === 1;
  }

  async reschedule(input: Parameters<DocumentProcessingJobRepository["reschedule"]>[0]) {
    const prisma = getPrismaClient();
    const updated = await prisma.documentProcessingJob.updateMany({
      where: { id: input.jobId, status: "PROCESSING", leaseToken: input.leaseToken },
      data: {
        status: "PENDING",
        nextAttemptAt: input.nextAttemptAt,
        leaseUntil: null,
        leaseToken: null,
        lastErrorCode: input.errorCode,
        failedAt: null,
        cancelledAt: null,
      },
    });
    return updated.count === 1;
  }

  async fail(input: Parameters<DocumentProcessingJobRepository["fail"]>[0]) {
    const prisma = getPrismaClient();
    const updated = await prisma.documentProcessingJob.updateMany({
      where: { id: input.jobId, status: "PROCESSING", leaseToken: input.leaseToken },
      data: {
        status: "FAILED",
        failedAt: input.failedAt,
        leaseUntil: null,
        leaseToken: null,
        lastErrorCode: input.errorCode,
        completedAt: null,
        cancelledAt: null,
      },
    });
    return updated.count === 1;
  }

  async cancel(input: Parameters<DocumentProcessingJobRepository["cancel"]>[0]) {
    const prisma = getPrismaClient();
    const updated = await prisma.documentProcessingJob.updateMany({
      where: { id: input.jobId, status: "PROCESSING", leaseToken: input.leaseToken },
      data: {
        status: "CANCELLED",
        cancelledAt: input.cancelledAt,
        leaseUntil: null,
        leaseToken: null,
        lastErrorCode: input.reasonCode,
        completedAt: null,
        failedAt: null,
      },
    });
    return updated.count === 1;
  }
}
