import "server-only";

import { getPrismaClient } from "@/server/database/prisma";
import type {
  StoredFileDeletionHealthRepository,
  StoredFileDeletionHealthSnapshot,
} from "@/server/domain/files/deletion-health";

export class PrismaStoredFileDeletionHealthRepository
  implements StoredFileDeletionHealthRepository
{
  async inspect(input: {
    overdueBefore: Date;
    limit: number;
  }): Promise<StoredFileDeletionHealthSnapshot> {
    const prisma = getPrismaClient();
    const take = input.limit + 1;

    const [pending, processing, attention] = await Promise.all([
      prisma.storedFileDeletion.findMany({
        where: {
          status: "PENDING",
          nextAttemptAt: { lte: input.overdueBefore },
        },
        select: { fileId: true },
        take,
      }),
      prisma.storedFileDeletion.findMany({
        where: {
          status: "PROCESSING",
          leaseUntil: { lte: input.overdueBefore },
        },
        select: { fileId: true },
        take,
      }),
      prisma.storedFileDeletion.findMany({
        where: { status: "REQUIRES_ATTENTION" },
        select: { fileId: true },
        take,
      }),
    ]);

    const saturated =
      pending.length > input.limit ||
      processing.length > input.limit ||
      attention.length > input.limit;

    return {
      overduePending: Math.min(pending.length, input.limit),
      expiredLeases: Math.min(processing.length, input.limit),
      attentionRequired: Math.min(attention.length, input.limit),
      saturated,
    };
  }
}
