import "server-only";

import { getPrismaClient } from "@/server/database/prisma";
import type {
  StoredFileScanHealthRepository,
  StoredFileScanHealthSnapshot,
} from "@/server/domain/files/scan-health";

function boundedCount(length: number, limit: number) {
  return Math.min(length, limit);
}

export class PrismaStoredFileScanHealthRepository implements StoredFileScanHealthRepository {
  async inspect(input: { overdueBefore: Date; limit: number }): Promise<StoredFileScanHealthSnapshot> {
    const prisma = getPrismaClient();
    const take = input.limit + 1;

    const [overduePendingRows, expiredLeaseRows, terminalFailureRows] = await Promise.all([
      prisma.storedFile.findMany({
        where: {
          status: "PENDING_SCAN",
          scanNextAttemptAt: { lte: input.overdueBefore },
        },
        select: { id: true },
        orderBy: [{ scanNextAttemptAt: "asc" }, { id: "asc" }],
        take,
      }),
      prisma.storedFile.findMany({
        where: {
          status: "SCANNING",
          scanLeaseUntil: { lte: input.overdueBefore },
        },
        select: { id: true },
        orderBy: [{ scanLeaseUntil: "asc" }, { id: "asc" }],
        take,
      }),
      prisma.storedFile.findMany({
        where: { status: "SCAN_FAILED" },
        select: { id: true },
        orderBy: { id: "asc" },
        take,
      }),
    ]);

    return {
      overduePending: boundedCount(overduePendingRows.length, input.limit),
      expiredLeases: boundedCount(expiredLeaseRows.length, input.limit),
      terminalFailures: boundedCount(terminalFailureRows.length, input.limit),
      saturated:
        overduePendingRows.length > input.limit ||
        expiredLeaseRows.length > input.limit ||
        terminalFailureRows.length > input.limit,
    };
  }
}
