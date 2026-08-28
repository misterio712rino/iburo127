import "server-only";

import { getPrismaClient } from "@/server/database/prisma";
import { AI_AUDIT_FAILED, type AiAuditOutcome, type AiUsageLedger } from "@/server/domain/ai/contracts";
import { buildCaseActivityWrite } from "@/server/repositories/prisma/case-activity-write";
import type { AiUsageRuntimeConfig } from "@/server/ai/usage-config";

const REQUEST_ACTIVITY_TYPE = "ai.request.accepted";
const OUTCOME_ACTIVITY_TYPES: Record<AiAuditOutcome, string> = {
  completed: "ai.response.completed",
  restricted: "ai.response.restricted",
  failed: "ai.response.failed",
};

export class PrismaAiUsageLedger implements AiUsageLedger {
  constructor(private readonly config: AiUsageRuntimeConfig) {}

  async reserveRequest(input: {
    clientCaseId: string;
    actorUserId: string;
    now: Date;
  }): Promise<boolean> {
    const prisma = getPrismaClient();
    const minuteStart = new Date(input.now.getTime() - 60_000);
    const dayStart = new Date(input.now.getTime() - 24 * 60 * 60_000);
    const lockKey = `ai-rate:${input.actorUserId}:${input.clientCaseId}`;

    try {
      return await prisma.$transaction(async (tx) => {
        // A transaction-scoped PostgreSQL advisory lock serializes rate-limit
        // reservations for the same authenticated user + case across app instances.
        await tx.$queryRaw<unknown[]>`
          SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))
        `;

        const dayCount = await tx.caseActivityEvent.count({
          where: {
            clientCaseId: input.clientCaseId,
            actorUserId: input.actorUserId,
            type: REQUEST_ACTIVITY_TYPE,
            createdAt: { gte: dayStart },
          },
        });
        if (dayCount >= this.config.perDay) return false;

        const minuteCount = await tx.caseActivityEvent.count({
          where: {
            clientCaseId: input.clientCaseId,
            actorUserId: input.actorUserId,
            type: REQUEST_ACTIVITY_TYPE,
            createdAt: { gte: minuteStart },
          },
        });
        if (minuteCount >= this.config.perMinute) return false;

        await tx.caseActivityEvent.create({
          data: buildCaseActivityWrite({
            clientCaseId: input.clientCaseId,
            actorUserId: input.actorUserId,
            type: REQUEST_ACTIVITY_TYPE,
            metadata: { schemaVersion: 1 },
          }),
        });
        return true;
      });
    } catch {
      throw new Error(AI_AUDIT_FAILED);
    }
  }

  async recordOutcome(input: {
    clientCaseId: string;
    actorUserId: string;
    outcome: AiAuditOutcome;
  }): Promise<void> {
    try {
      await getPrismaClient().caseActivityEvent.create({
        data: buildCaseActivityWrite({
          clientCaseId: input.clientCaseId,
          actorUserId: input.actorUserId,
          type: OUTCOME_ACTIVITY_TYPES[input.outcome],
          metadata: { schemaVersion: 1 },
        }),
      });
    } catch {
      throw new Error(AI_AUDIT_FAILED);
    }
  }
}
