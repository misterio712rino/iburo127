import "server-only";

import { getPrismaClient } from "@/server/database/prisma";
import type {
  StoredFileRecord,
  StoredFileRepository,
} from "@/server/domain/files/contracts";

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

  async create(input: {
    clientCaseId: string;
    uploadedById: string | null;
    storageProvider: string;
    objectKey: string;
    fileName: string;
    mimeType: string;
    sizeBytes: bigint;
    checksumSha256?: string | null;
  }) {
    const prisma = getPrismaClient();
    const row = await prisma.storedFile.create({
      data: {
        ...input,
        checksumSha256: input.checksumSha256 ?? null,
      },
    });
    return toRecord(row);
  }
}
