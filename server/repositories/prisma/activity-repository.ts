import "server-only";

import { getPrismaClient } from "@/server/database/prisma";
import type { AuthenticatedActor } from "@/server/domain/client-cases/contracts";
import type {
  ActivityMetadata,
  ActivityMetadataValue,
  CaseActivityRecord,
  CaseActivityRepository,
} from "@/server/domain/activity/contracts";

const HUMAN_SUPPORT_PLAN_CODES = ["PRO", "INDIVIDUAL"] as const;

type ActorCaseAccessClause =
  | { clientId: string }
  | {
      assignedLawyerId: string;
      plan: { code: { in: Array<(typeof HUMAN_SUPPORT_PLAN_CODES)[number]> } };
    };

function actorActivityWhere(actor: AuthenticatedActor) {
  if (actor.roles.includes("MANAGER")) return {};

  const access: ActorCaseAccessClause[] = [];
  if (actor.roles.includes("CLIENT")) access.push({ clientId: actor.userId });
  if (actor.roles.includes("LAWYER")) {
    access.push({
      assignedLawyerId: actor.userId,
      plan: { code: { in: [...HUMAN_SUPPORT_PLAN_CODES] } },
    });
  }

  return access.length
    ? {
        clientCase: {
          is: { OR: access },
        },
      }
    : null;
}

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
  async listByCase(clientCaseId: string, limit: number, actor: AuthenticatedActor) {
    const scope = actorActivityWhere(actor);
    if (!scope) return [];

    const prisma = getPrismaClient();
    const rows = await prisma.caseActivityEvent.findMany({
      where: { clientCaseId, ...scope },
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
