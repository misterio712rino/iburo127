import "server-only";

import { getPrismaClient } from "@/server/database/prisma";
import {
  DOCUMENT_REVISION_INVALID_TRANSITION,
  DOCUMENT_REVISION_NOT_FOUND,
  type CaseDocumentRevisionRecord,
  type CaseDocumentRevisionRepository,
  type DocumentSourceValue,
} from "@/server/domain/documents/revision-contracts";

function toRecord(row: {
  id: string;
  caseDocumentId: string;
  revisionNumber: number;
  templateCode: string;
  templateVersion: number;
  templateSourceHash: string;
  questionnaireVersion: number;
  sourceDataHash: string;
  sourceData: unknown;
  status: "DRAFT" | "IN_REVIEW" | "CHANGES_REQUESTED" | "APPROVED" | "SUPERSEDED";
  createdByUserId: string;
  submittedByUserId: string | null;
  submittedAt: Date | null;
  reviewedByUserId: string | null;
  reviewNote: string | null;
  reviewedAt: Date | null;
  approvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): CaseDocumentRevisionRecord {
  return { ...row, sourceData: row.sourceData as DocumentSourceValue };
}

export class PrismaCaseDocumentRevisionRepository implements CaseDocumentRevisionRepository {
  async getLatest(caseDocumentId: string) {
    const row = await getPrismaClient().caseDocumentRevision.findFirst({
      where: { caseDocumentId },
      orderBy: { revisionNumber: "desc" },
    });
    return row ? toRecord(row) : null;
  }

  async getById(revisionId: string) {
    const row = await getPrismaClient().caseDocumentRevision.findUnique({ where: { id: revisionId } });
    return row ? toRecord(row) : null;
  }

  async createDraft(input: {
    caseDocumentId: string;
    createdByUserId: string;
    templateCode: string;
    templateVersion: number;
    templateSourceHash: string;
    questionnaireVersion: number;
    sourceDataHash: string;
    sourceData: DocumentSourceValue;
  }) {
    const prisma = getPrismaClient();
    return prisma.$transaction(async (tx) => {
      const latest = await tx.caseDocumentRevision.findFirst({
        where: { caseDocumentId: input.caseDocumentId },
        orderBy: { revisionNumber: "desc" },
      });
      if (latest?.status === "IN_REVIEW") throw new Error(DOCUMENT_REVISION_INVALID_TRANSITION);

      if (latest && (latest.status === "DRAFT" || latest.status === "CHANGES_REQUESTED")) {
        const superseded = await tx.caseDocumentRevision.updateMany({
          where: { id: latest.id, status: latest.status },
          data: { status: "SUPERSEDED" },
        });
        if (superseded.count !== 1) throw new Error(DOCUMENT_REVISION_INVALID_TRANSITION);
      }

      const row = await tx.caseDocumentRevision.create({
        data: {
          ...input,
          sourceData: input.sourceData,
          revisionNumber: (latest?.revisionNumber ?? 0) + 1,
          status: "DRAFT",
        },
      });
      return toRecord(row);
    });
  }

  async submitForReview(input: { revisionId: string; submittedByUserId: string }) {
    const prisma = getPrismaClient();
    return prisma.$transaction(async (tx) => {
      const updated = await tx.caseDocumentRevision.updateMany({
        where: { id: input.revisionId, status: { in: ["DRAFT", "CHANGES_REQUESTED"] } },
        data: {
          status: "IN_REVIEW",
          submittedByUserId: input.submittedByUserId,
          submittedAt: new Date(),
          reviewedByUserId: null,
          reviewNote: null,
          reviewedAt: null,
          approvedAt: null,
        },
      });
      if (updated.count !== 1) throw new Error(DOCUMENT_REVISION_INVALID_TRANSITION);
      const row = await tx.caseDocumentRevision.findUnique({ where: { id: input.revisionId } });
      if (!row) throw new Error(DOCUMENT_REVISION_NOT_FOUND);
      return toRecord(row);
    });
  }

  async requestChanges(input: { revisionId: string; reviewerUserId: string; reviewNote: string }) {
    const prisma = getPrismaClient();
    return prisma.$transaction(async (tx) => {
      const updated = await tx.caseDocumentRevision.updateMany({
        where: { id: input.revisionId, status: "IN_REVIEW" },
        data: {
          status: "CHANGES_REQUESTED",
          reviewedByUserId: input.reviewerUserId,
          reviewNote: input.reviewNote,
          reviewedAt: new Date(),
          approvedAt: null,
        },
      });
      if (updated.count !== 1) throw new Error(DOCUMENT_REVISION_INVALID_TRANSITION);
      const row = await tx.caseDocumentRevision.findUnique({ where: { id: input.revisionId } });
      if (!row) throw new Error(DOCUMENT_REVISION_NOT_FOUND);
      return toRecord(row);
    });
  }

  async approve(input: { revisionId: string; reviewerUserId: string; reviewNote: string | null }) {
    const prisma = getPrismaClient();
    return prisma.$transaction(async (tx) => {
      const now = new Date();
      const updated = await tx.caseDocumentRevision.updateMany({
        where: { id: input.revisionId, status: "IN_REVIEW" },
        data: {
          status: "APPROVED",
          reviewedByUserId: input.reviewerUserId,
          reviewNote: input.reviewNote,
          reviewedAt: now,
          approvedAt: now,
        },
      });
      if (updated.count !== 1) throw new Error(DOCUMENT_REVISION_INVALID_TRANSITION);
      const row = await tx.caseDocumentRevision.findUnique({ where: { id: input.revisionId } });
      if (!row) throw new Error(DOCUMENT_REVISION_NOT_FOUND);
      return toRecord(row);
    });
  }
}
