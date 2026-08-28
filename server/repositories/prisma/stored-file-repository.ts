import "server-only";

import { getPrismaClient } from "@/server/database/prisma";
import type {
  StoredFileRecord,
  StoredFileRepository,
  StoredFileStatus,
} from "@/server/domain/files/contracts";
import { buildCaseActivityWrite } from "@/server/repositories/prisma/case-activity-write";
import { isPrismaUniqueConstraintError } from "@/server/repositories/prisma/errors";

function toRecord(row: StoredFileRecord): StoredFileRecord {
  return row;
}

export class PrismaStoredFileRepository implements StoredFileRepository {
  async listByCase(clientCaseId: string) {
    const prisma = getPrismaClient();
    const rows = await prisma.storedFile.findMany({
      where: { clientCaseId, status: "READY" },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toRecord);
  }

  async getById(fileId: string) {
    const prisma = getPrismaClient();
    const row = await prisma.storedFile.findUnique({ where: { id: fileId } });
    return row ? toRecord(row) : null;
  }

  async listPendingBefore(before: Date, limit: number) {
    const prisma = getPrismaClient();
    const rows = await prisma.storedFile.findMany({
      where: {
        status: "PENDING_UPLOAD",
        createdAt: { lt: before },
      },
      orderBy: { createdAt: "asc" },
      take: limit,
    });
    return rows.map(toRecord);
  }

  async create(input: {
    id: string;
    clientCaseId: string;
    uploadedById: string | null;
    status: StoredFileStatus;
    storageProvider: string;
    objectKey: string;
    fileName: string;
    mimeType: string;
    sizeBytes: bigint;
    checksumSha256?: string | null;
  }) {
    const prisma = getPrismaClient();
    return prisma.$transaction(async (tx) => {
      const row = await tx.storedFile.create({
        data: {
          ...input,
          checksumSha256: input.checksumSha256 ?? null,
        },
      });

      if (input.status === "PENDING_UPLOAD" && input.uploadedById) {
        await tx.caseActivityEvent.create({
          data: buildCaseActivityWrite({
            clientCaseId: input.clientCaseId,
            actorUserId: input.uploadedById,
            type: "file.upload.registered",
            metadata: {
              fileId: input.id,
              storageProvider: input.storageProvider,
            },
          }),
        });
      }

      return toRecord(row);
    });
  }

  async markReady(fileId: string, readyAt: Date) {
    const prisma = getPrismaClient();
    const row = await prisma.storedFile.update({
      where: { id: fileId },
      data: { status: "READY", readyAt },
    });
    return toRecord(row);
  }

  async deletePending(fileId: string) {
    const prisma = getPrismaClient();
    const result = await prisma.storedFile.deleteMany({
      where: {
        id: fileId,
        status: "PENDING_UPLOAD",
      },
    });
    return result.count === 1;
  }

  async restorePending(file: StoredFileRecord) {
    if (file.status !== "PENDING_UPLOAD" || file.readyAt !== null) return false;
    const prisma = getPrismaClient();

    try {
      await prisma.storedFile.create({
        data: {
          id: file.id,
          clientCaseId: file.clientCaseId,
          uploadedById: file.uploadedById,
          status: "PENDING_UPLOAD",
          storageProvider: file.storageProvider,
          objectKey: file.objectKey,
          fileName: file.fileName,
          mimeType: file.mimeType,
          sizeBytes: file.sizeBytes,
          checksumSha256: file.checksumSha256,
          readyAt: null,
          createdAt: file.createdAt,
        },
      });
      return true;
    } catch (error) {
      if (!isPrismaUniqueConstraintError(error)) throw error;
      const existing = await prisma.storedFile.findUnique({ where: { id: file.id } });
      return Boolean(
        existing &&
          existing.clientCaseId === file.clientCaseId &&
          existing.objectKey === file.objectKey,
      );
    }
  }
}
