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

function assertExpectedVersion(currentVersion: number, expectedVersion: number) {
  if (currentVersion !== expectedVersion) {
    throw new Error(DOCUMENT_VERSION_CONFLICT);
  }
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
    expectedVersion: number;
  }) {
    const prisma = getPrismaClient();
    return prisma.$transaction(async (tx) => {
      const current = await tx.caseDocument.findUnique({
        where: {
          clientCaseId_documentCode: {
            clientCaseId: input.clientCaseId,
            documentCode: input.documentCode,
          },
        },
      });
      if (!current) throw new Error(DOCUMENT_NOT_FOUND);
      assertExpectedVersion(current.version, input.expectedVersion);

      const updated = await tx.caseDocument.updateMany({
        where: { id: current.id, version: input.expectedVersion },
        data: {
          status: input.status,
          regeneratedAt: new Date(),
          sentForReviewAt: null,
          reviewedAt: null,
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1) throw new Error(DOCUMENT_VERSION_CONFLICT);

      const row = await tx.caseDocument.findUnique({ where: { id: current.id } });
      if (!row) throw new Error(DOCUMENT_NOT_FOUND);
      return toRecord(row);
    });
  }

  async sendForReview(input: {
    clientCaseId: string;
    documentCode: string;
    expectedVersion: number;
  }) {
    const prisma = getPrismaClient();
    return prisma.$transaction(async (tx) => {
      const current = await tx.caseDocument.findUnique({
        where: {
          clientCaseId_documentCode: {
            clientCaseId: input.clientCaseId,
            documentCode: input.documentCode,
          },
        },
      });
      if (!current) throw new Error(DOCUMENT_NOT_FOUND);
      assertExpectedVersion(current.version, input.expectedVersion);

      const updated = await tx.caseDocument.updateMany({
        where: { id: current.id, version: input.expectedVersion },
        data: {
          status: "SENT_FOR_REVIEW",
          sentForReviewAt: new Date(),
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1) throw new Error(DOCUMENT_VERSION_CONFLICT);

      const row = await tx.caseDocument.findUnique({ where: { id: current.id } });
      if (!row) throw new Error(DOCUMENT_NOT_FOUND);
      return toRecord(row);
    });
  }

  async markReviewed(input: {
    clientCaseId: string;
    documentCode: string;
    expectedVersion: number;
  }) {
    const prisma = getPrismaClient();
    return prisma.$transaction(async (tx) => {
      const current = await tx.caseDocument.findUnique({
        where: {
          clientCaseId_documentCode: {
            clientCaseId: input.clientCaseId,
            documentCode: input.documentCode,
          },
        },
      });
      if (!current) throw new Error(DOCUMENT_NOT_FOUND);
      assertExpectedVersion(current.version, input.expectedVersion);

      const updated = await tx.caseDocument.updateMany({
        where: { id: current.id, version: input.expectedVersion },
        data: {
          status: "REVIEWED",
          reviewedAt: new Date(),
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1) throw new Error(DOCUMENT_VERSION_CONFLICT);

      const row = await tx.caseDocument.findUnique({ where: { id: current.id } });
      if (!row) throw new Error(DOCUMENT_NOT_FOUND);
      return toRecord(row);
    });
  }
}
