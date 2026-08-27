import "server-only";

import { getPrismaClient } from "@/server/database/prisma";
import {
  DOCUMENT_NOT_FOUND,
  DOCUMENT_VERSION_CONFLICT,
  type CaseDocumentRecord,
  type CaseDocumentRepository,
  type CaseDocumentStatus,
} from "@/server/domain/documents/contracts";

function toRecord(row: {
  id: string;
  clientCaseId: string;
  documentCode: string;
  status: CaseDocumentStatus;
  regeneratedAt: Date | null;
  sentForReviewAt: Date | null;
  reviewedAt: Date | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}): CaseDocumentRecord {
  return row;
}

async function updateDocument(
  clientCaseId: string,
  documentCode: string,
  expectedVersion: number | undefined,
  data: (current: CaseDocumentRecord, now: Date) => Record<string, unknown>,
) {
  const prisma = getPrismaClient();
  return prisma.$transaction(async (tx) => {
    const current = await tx.caseDocument.findUnique({
      where: { clientCaseId_documentCode: { clientCaseId, documentCode } },
    });
    if (!current) throw new Error(DOCUMENT_NOT_FOUND);
    if (expectedVersion !== undefined && current.version !== expectedVersion) {
      throw new Error(DOCUMENT_VERSION_CONFLICT);
    }

    const updated = await tx.caseDocument.updateMany({
      where: { id: current.id, version: current.version },
      data: {
        ...data(toRecord(current), new Date()),
        version: { increment: 1 },
      },
    });
    if (updated.count !== 1) throw new Error(DOCUMENT_VERSION_CONFLICT);

    const row = await tx.caseDocument.findUnique({ where: { id: current.id } });
    if (!row) throw new Error(DOCUMENT_NOT_FOUND);
    return toRecord(row);
  });
}

export class PrismaCaseDocumentRepository implements CaseDocumentRepository {
  async getByCaseAndCode(clientCaseId: string, documentCode: string) {
    const prisma = getPrismaClient();
    const row = await prisma.caseDocument.findUnique({
      where: { clientCaseId_documentCode: { clientCaseId, documentCode } },
    });
    return row ? toRecord(row) : null;
  }

  async listByCase(clientCaseId: string) {
    const prisma = getPrismaClient();
    const rows = await prisma.caseDocument.findMany({
      where: { clientCaseId },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(toRecord);
  }

  async createForCase(input: {
    clientCaseId: string;
    documentCode: string;
    status: CaseDocumentStatus;
  }) {
    const prisma = getPrismaClient();
    const row = await prisma.caseDocument.create({ data: input });
    return toRecord(row);
  }

  async regenerate(input: {
    clientCaseId: string;
    documentCode: string;
    status: CaseDocumentStatus;
    expectedVersion?: number;
  }) {
    return updateDocument(
      input.clientCaseId,
      input.documentCode,
      input.expectedVersion,
      (_current, now) => ({
        status: input.status,
        regeneratedAt: now,
        sentForReviewAt: null,
        reviewedAt: null,
      }),
    );
  }

  async sendForReview(input: {
    clientCaseId: string;
    documentCode: string;
    expectedVersion?: number;
  }) {
    return updateDocument(
      input.clientCaseId,
      input.documentCode,
      input.expectedVersion,
      (_current, now) => ({ status: "SENT_FOR_REVIEW", sentForReviewAt: now }),
    );
  }

  async markReviewed(input: {
    clientCaseId: string;
    documentCode: string;
    expectedVersion?: number;
  }) {
    return updateDocument(
      input.clientCaseId,
      input.documentCode,
      input.expectedVersion,
      (_current, now) => ({ status: "REVIEWED", reviewedAt: now }),
    );
  }
}
