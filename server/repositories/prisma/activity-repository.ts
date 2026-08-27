import "server-only";

import { getPrismaClient } from "@/server/database/prisma";
import type {
  ActivityMetadata,
  ActivityMetadataValue,
  CaseActivityRecord,
  CaseActivityRepository,
} from "@/server/domain/activity/contracts";

function normalizeMetadata(value: unknown): ActivityMetadata | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const metadata: ActivityMetadata = {};
  for (const [key, item] of Object.entries(value)) {
    if (
      typeof item === "string" ||
      typeof item === "number" ||
      typeof item === "boolean" ||
      item === null
    ) {
      metadata[key] = item as ActivityMetadataValue;
    }
  }
  return metadata;
}

function toRecord(row: {
  id: string;
  clientCaseId: string;
  actorUserId: string | null;
  type: string;
  metadata: unknown;
  createdAt: Date;
}): CaseActivityRecord {
  return {
    ...row,
    metadata: normalizeMetadata(row.metadata),
  };
}

export class PrismaCaseActivityRepository implements CaseActivityRepository {
  async listByCase(clientCaseId: string, limit: number) {
    const prisma = getPrismaClient();
    const rows = await prisma.caseActivityEvent.findMany({
      where: { clientCaseId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return rows.map(toRecord);
  }

  async append(input: {
    clientCaseId: string;
    actorUserId: string | null;
    type: string;
    metadata?: ActivityMetadata;
  }) {
    const prisma = getPrismaClient();
    const row = await prisma.caseActivityEvent.create({
      data: {
        clientCaseId: input.clientCaseId,
        actorUserId: input.actorUserId,
        type: input.type,
        metadata: input.metadata,
      },
    });
    return toRecord(row);
  }
}
