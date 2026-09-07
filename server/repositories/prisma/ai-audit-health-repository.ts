import "server-only";

import { getPrismaClient } from "@/server/database/prisma";
import type { AiAuditHealthRepository } from "@/server/ai/audit-health";

const UUID_V4_POSTGRES_REGEX =
  "^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$";

export class PrismaAiAuditHealthRepository implements AiAuditHealthRepository {
  async countOrphanedAccepted(input: {
    cutoff: Date;
    limit: number;
  }): Promise<number> {
    const rows = await getPrismaClient().$queryRaw<Array<{ orphanCount: number }>>`
      SELECT COUNT(*)::int AS "orphanCount"
      FROM (
        SELECT accepted.id
        FROM "CaseActivityEvent" AS accepted
        WHERE accepted.type = 'ai.request.accepted'
          AND accepted."createdAt" <= ${input.cutoff}
          AND jsonb_typeof(accepted.metadata) = 'object'
          AND (accepted.metadata ->> 'auditId') ~* ${UUID_V4_POSTGRES_REGEX}
          AND NOT EXISTS (
            SELECT 1
            FROM "CaseActivityEvent" AS outcome
            WHERE outcome."clientCaseId" = accepted."clientCaseId"
              AND outcome."actorUserId" IS NOT DISTINCT FROM accepted."actorUserId"
              AND outcome.type IN (
                'ai.response.completed',
                'ai.response.restricted',
                'ai.response.failed'
              )
              AND jsonb_typeof(outcome.metadata) = 'object'
              AND (outcome.metadata ->> 'auditId') = (accepted.metadata ->> 'auditId')
          )
        ORDER BY accepted."createdAt" ASC
        LIMIT ${input.limit}
      ) AS orphaned
    `;

    return rows[0]?.orphanCount ?? 0;
  }
}
