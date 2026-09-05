import "server-only";

import { getPrismaClient } from "@/server/database/prisma";
import type {
  TaskReminderCandidate,
  TaskReminderSource,
} from "@/server/tasks/reminder-worker";

function mapCandidates(rows: Array<{
  id: string;
  clientCaseId: string;
  assigneeId: string;
  dueAt: Date | null;
  createdAt: Date;
  clientCase: { caseNumber: string; clientId: string };
}>): TaskReminderCandidate[] {
  return rows
    .filter((row) => row.clientCase.clientId !== row.assigneeId)
    .map((row) => ({
      id: row.id,
      clientCaseId: row.clientCaseId,
      assigneeId: row.assigneeId,
      caseNumber: row.clientCase.caseNumber,
      dueAt: row.dueAt,
      createdAt: row.createdAt,
    }));
}

const includeCase = {
  clientCase: {
    select: { caseNumber: true, clientId: true },
  },
} as const;

export class PrismaTaskReminderSource implements TaskReminderSource {
  async listRecentlyAssigned(input: { createdAfter: Date; limit: number }) {
    const prisma = getPrismaClient();
    const rows = await prisma.caseTask.findMany({
      where: {
        status: { in: ["NEW", "WORKING"] },
        createdAt: { gte: input.createdAfter },
        assignee: { is: { status: "ACTIVE" } },
      },
      include: includeCase,
      orderBy: { createdAt: "asc" },
      take: input.limit,
    });
    return mapCandidates(rows);
  }

  async listDueSoon(input: { after: Date; through: Date; limit: number }) {
    const prisma = getPrismaClient();
    const rows = await prisma.caseTask.findMany({
      where: {
        status: { in: ["NEW", "WORKING"] },
        dueAt: { gt: input.after, lte: input.through },
        assignee: { is: { status: "ACTIVE" } },
      },
      include: includeCase,
      orderBy: { dueAt: "asc" },
      take: input.limit,
    });
    return mapCandidates(rows);
  }

  async listRecentlyOverdue(input: { after: Date; through: Date; limit: number }) {
    const prisma = getPrismaClient();
    const rows = await prisma.caseTask.findMany({
      where: {
        status: { in: ["NEW", "WORKING"] },
        dueAt: { gte: input.after, lte: input.through },
        assignee: { is: { status: "ACTIVE" } },
      },
      include: includeCase,
      orderBy: { dueAt: "asc" },
      take: input.limit,
    });
    return mapCandidates(rows);
  }
}
