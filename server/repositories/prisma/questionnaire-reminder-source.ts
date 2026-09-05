import "server-only";

import { getPrismaClient } from "@/server/database/prisma";
import type {
  QuestionnaireReminderCandidate,
  QuestionnaireReminderSource,
} from "@/server/questionnaire/reminder-worker";

export class PrismaQuestionnaireReminderSource implements QuestionnaireReminderSource {
  async listInactive(input: {
    inactiveBefore: Date;
    remindedAfter: Date;
    limit: number;
  }): Promise<readonly QuestionnaireReminderCandidate[]> {
    const prisma = getPrismaClient();
    const rows = await prisma.caseQuestionnaire.findMany({
      where: {
        status: { in: ["NOT_STARTED", "IN_PROGRESS"] },
        updatedAt: { lte: input.inactiveBefore },
        clientCase: {
          is: {
            status: "ACTIVE",
            client: { is: { status: "ACTIVE" } },
            notifications: {
              none: {
                type: "questionnaire.reminder",
                createdAt: { gte: input.remindedAfter },
              },
            },
          },
        },
      },
      select: {
        clientCaseId: true,
        updatedAt: true,
        clientCase: {
          select: {
            caseNumber: true,
            clientId: true,
          },
        },
      },
      orderBy: { updatedAt: "asc" },
      take: input.limit,
    });

    return rows.map((row) => ({
      clientCaseId: row.clientCaseId,
      clientId: row.clientCase.clientId,
      caseNumber: row.clientCase.caseNumber,
      updatedAt: row.updatedAt,
    }));
  }
}
