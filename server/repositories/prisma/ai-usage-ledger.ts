import "server-only";

import { randomUUID } from "node:crypto";
import { buildAiAuditMetadata } from "@/server/ai/audit-correlation";
import { getPrismaClient } from "@/server/database/prisma";
import {
  AI_AUDIT_FAILED,
  type AiAuditOutcome,
  type AiUsageLedger,
  type AiUsageReservation,
} from "@/server/domain/ai/contracts";
import { buildCaseActivityWrite } from "@/server/repositories/prisma/case-activity-write";
import type { AiUsageRuntimeConfig } from "@/server/ai/usage-config";

export const AI_REQUEST_ACTIVITY_TYPE = "ai.request.accepted";
export const AI_OUTCOME_ACTIVITY_TYPES: Record<AiAuditOutcome, string> = {
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
  }): Promise<AiUsageReservation | null> {
    const prisma = getPrismaClient();
    const minuteStart = new Date(input.now.getTime() - 60_000);
    const dayStart = new Date(input.now.getTime() - 24 * 60 * 60_000);
    const lockKey = `ai-rate:${input.actorUserId}:${input.clientCaseId}`;
    const auditId = randomUUID();

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
            type: AI_REQUEST_ACTIVITY_TYPE,
            createdAt: { gte: dayStart },
          },
        });
        if (dayCount >= this.config.perDay) return null;

        const minuteCount = await tx.caseActivityEvent.count({
          where: {
            clientCaseId: input.clientCaseId,
            actorUserId: input.actorUserId,
            type: AI_REQUEST_ACTIVITY_TYPE,
            createdAt: { gte: minuteStart },
          },
        });
        if (minuteCount >= this.config.perMinute) return null;

        await tx.caseActivityEvent.create({
          data: buildCaseActivityWrite({
            clientCaseId: input.clientCaseId,
            actorUserId: input.actorUserId,
            type: AI_REQUEST_ACTIVITY_TYPE,
            metadata: buildAiAuditMetadata(auditId),
          }),
        });
        return { auditId };
      });
    } catch {
      throw new Error(AI_AUDIT_FAILED);
    }
  }

  async recordOutcome(input: {
    clientCaseId: string;
    actorUserId: string;
    auditId: string;
    outcome: AiAuditOutcome;
  }): Promise<void> {
    try {
      await getPrismaClient().caseActivityEvent.create({
        data: buildCaseActivityWrite({
          clientCaseId: input.clientCaseId,
          actorUserId: input.actorUserId,
          type: AI_OUTCOME_ACTIVITY_TYPES[input.outcome],
          metadata: buildAiAuditMetadata(input.auditId),
        }),
      });
    } catch {
      throw new Error(AI_AUDIT_FAILED);
    }
  }
}
