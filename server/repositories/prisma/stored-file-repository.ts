import "server-only";

import { randomUUID } from "node:crypto";
import { getPrismaClient } from "@/server/database/prisma";
import type {
  ClaimedStoredFileScan,
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
      where: { clientCaseId },
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

  async markPendingScan(fileId: string, scanNextAttemptAt: Date, auditActorUserId: string) {
    const prisma = getPrismaClient();
    return prisma.$transaction(async (tx) => {
      const current = await tx.storedFile.findUnique({ where: { id: fileId } });
      if (
        !current ||
        current.status !== "PENDING_UPLOAD" ||
        current.uploadedById !== auditActorUserId
      ) {
        return null;
      }

      const updated = await tx.storedFile.updateMany({
        where: {
          id: current.id,
          status: "PENDING_UPLOAD",
          uploadedById: auditActorUserId,
        },
        data: {
          status: "PENDING_SCAN",
          scanNextAttemptAt,
          scanLeaseUntil: null,
          scanLeaseToken: null,
          scanProvider: null,
          scanLastErrorCode: null,
          scannedAt: null,
          quarantinedAt: null,
          readyAt: null,
        },
      });
      if (updated.count !== 1) return null;

      await tx.caseActivityEvent.create({
        data: buildCaseActivityWrite({
          clientCaseId: current.clientCaseId,
          actorUserId: auditActorUserId,
          type: "file.upload.completed",
          metadata: {
            fileId: current.id,
            storageProvider: current.storageProvider,
            fileStatus: "PENDING_SCAN",
          },
        }),
      });

      const row = await tx.storedFile.findUnique({ where: { id: current.id } });
      return row ? toRecord(row) : null;
    });
  }

  async claimDueScan(input: { now: Date; leaseUntil: Date }) {
    const prisma = getPrismaClient();
    const eligible = {
      OR: [
        {
          status: "PENDING_SCAN" as const,
          scanNextAttemptAt: { lte: input.now },
        },
        {
          status: "SCANNING" as const,
          scanLeaseUntil: { lte: input.now },
        },
      ],
    };

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = await prisma.storedFile.findFirst({
        where: eligible,
        orderBy: [{ scanNextAttemptAt: "asc" }, { createdAt: "asc" }],
        select: { id: true },
      });
      if (!candidate) return null;

      const leaseToken = randomUUID();
      const claimed = await prisma.storedFile.updateMany({
        where: { id: candidate.id, ...eligible },
        data: {
          status: "SCANNING",
          scanLeaseUntil: input.leaseUntil,
          scanLeaseToken: leaseToken,
          scanAttemptCount: { increment: 1 },
          scanLastErrorCode: null,
        },
      });
      if (claimed.count !== 1) continue;

      const row = await prisma.storedFile.findUnique({ where: { id: candidate.id } });
      if (!row || row.status !== "SCANNING" || row.scanLeaseToken !== leaseToken) continue;

      return toRecord(row) as ClaimedStoredFileScan;
    }

    return null;
  }

  async markScanClean(input: {
    fileId: string;
    leaseToken: string;
    providerCode: string;
    scannedAt: Date;
  }) {
    const prisma = getPrismaClient();
    return prisma.$transaction(async (tx) => {
      const current = await tx.storedFile.findUnique({ where: { id: input.fileId } });
      if (
        !current ||
        current.status !== "SCANNING" ||
        current.scanLeaseToken !== input.leaseToken
      ) {
        return null;
      }

      const updated = await tx.storedFile.updateMany({
        where: {
          id: input.fileId,
          status: "SCANNING",
          scanLeaseToken: input.leaseToken,
        },
        data: {
          status: "READY",
          scanProvider: input.providerCode,
          scanLastErrorCode: null,
          scannedAt: input.scannedAt,
          quarantinedAt: null,
          readyAt: input.scannedAt,
          scanNextAttemptAt: null,
          scanLeaseUntil: null,
          scanLeaseToken: null,
        },
      });
      if (updated.count !== 1) return null;

      await tx.caseActivityEvent.create({
        data: buildCaseActivityWrite({
          clientCaseId: current.clientCaseId,
          actorUserId: null,
          type: "file.scan.clean",
          metadata: {
            fileId: current.id,
            storageProvider: current.storageProvider,
            scanProvider: input.providerCode,
            fileStatus: "READY",
          },
        }),
      });

      const row = await tx.storedFile.findUnique({ where: { id: input.fileId } });
      return row ? toRecord(row) : null;
    });
  }

  async markScanQuarantined(input: {
    fileId: string;
    leaseToken: string;
    providerCode: string;
    scannedAt: Date;
  }) {
    const prisma = getPrismaClient();
    return prisma.$transaction(async (tx) => {
      const current = await tx.storedFile.findUnique({ where: { id: input.fileId } });
      if (
        !current ||
        current.status !== "SCANNING" ||
        current.scanLeaseToken !== input.leaseToken
      ) {
        return null;
      }

      const updated = await tx.storedFile.updateMany({
        where: {
          id: input.fileId,
          status: "SCANNING",
          scanLeaseToken: input.leaseToken,
        },
        data: {
          status: "QUARANTINED",
          scanProvider: input.providerCode,
          scanLastErrorCode: null,
          scannedAt: input.scannedAt,
          quarantinedAt: input.scannedAt,
          readyAt: null,
          scanNextAttemptAt: null,
          scanLeaseUntil: null,
          scanLeaseToken: null,
        },
      });
      if (updated.count !== 1) return null;

      await tx.caseActivityEvent.create({
        data: buildCaseActivityWrite({
          clientCaseId: current.clientCaseId,
          actorUserId: null,
          type: "file.scan.quarantined",
          metadata: {
            fileId: current.id,
            storageProvider: current.storageProvider,
            scanProvider: input.providerCode,
            fileStatus: "QUARANTINED",
          },
        }),
      });

      const row = await tx.storedFile.findUnique({ where: { id: input.fileId } });
      return row ? toRecord(row) : null;
    });
  }

  async rescheduleScan(input: {
    fileId: string;
    leaseToken: string;
    nextAttemptAt: Date;
    providerCode: string;
    errorCode: string;
  }) {
    const prisma = getPrismaClient();
    const updated = await prisma.storedFile.updateMany({
      where: {
        id: input.fileId,
        status: "SCANNING",
        scanLeaseToken: input.leaseToken,
      },
      data: {
        status: "PENDING_SCAN",
        scanProvider: input.providerCode,
        scanLastErrorCode: input.errorCode,
        scanNextAttemptAt: input.nextAttemptAt,
        scanLeaseUntil: null,
        scanLeaseToken: null,
      },
    });
    return updated.count === 1;
  }

  async markScanFailed(input: {
    fileId: string;
    leaseToken: string;
    providerCode: string;
    scannedAt: Date;
    errorCode: string;
  }) {
    const prisma = getPrismaClient();
    return prisma.$transaction(async (tx) => {
      const current = await tx.storedFile.findUnique({ where: { id: input.fileId } });
      if (
        !current ||
        current.status !== "SCANNING" ||
        current.scanLeaseToken !== input.leaseToken
      ) {
        return false;
      }

      const updated = await tx.storedFile.updateMany({
        where: {
          id: input.fileId,
          status: "SCANNING",
          scanLeaseToken: input.leaseToken,
        },
        data: {
          status: "SCAN_FAILED",
          scanProvider: input.providerCode,
          scanLastErrorCode: input.errorCode,
          scannedAt: input.scannedAt,
          readyAt: null,
          scanNextAttemptAt: null,
          scanLeaseUntil: null,
          scanLeaseToken: null,
        },
      });
      if (updated.count !== 1) return false;

      await tx.caseActivityEvent.create({
        data: buildCaseActivityWrite({
          clientCaseId: current.clientCaseId,
          actorUserId: null,
          type: "file.scan.failed",
          metadata: {
            fileId: current.id,
            storageProvider: current.storageProvider,
            scanProvider: input.providerCode,
            fileStatus: "SCAN_FAILED",
          },
        }),
      });
      return true;
    });
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
          scanAttemptCount: 0,
          scanNextAttemptAt: null,
          scanLeaseUntil: null,
          scanLeaseToken: null,
          scanProvider: null,
          scanLastErrorCode: null,
          scannedAt: null,
          quarantinedAt: null,
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
