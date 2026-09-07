import "server-only";

import { getPrismaClient } from "@/server/database/prisma";
import type {
  StaleUploadHealthRepository,
  StaleUploadHealthSnapshot,
} from "@/server/domain/files/stale-upload-health";

export class PrismaStaleUploadHealthRepository implements StaleUploadHealthRepository {
  async inspect(input: {
    overdueBefore: Date;
    limit: number;
  }): Promise<StaleUploadHealthSnapshot> {
    const prisma = getPrismaClient();
    const rows = await prisma.storedFile.findMany({
      where: {
        status: "PENDING_UPLOAD",
        createdAt: { lte: input.overdueBefore },
      },
      select: { id: true },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: input.limit + 1,
    });

    return {
      overdue: Math.min(rows.length, input.limit),
      saturated: rows.length > input.limit,
    };
  }
}
