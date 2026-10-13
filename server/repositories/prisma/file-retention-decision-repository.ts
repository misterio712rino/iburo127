import "server-only";

import { getPrismaClient } from "@/server/database/prisma";
import type {
  FileRetentionDecisionRepository,
  RetentionCase,
  RetentionDecision,
} from "@/server/domain/files/retention-decision-service";

export class PrismaFileRetentionDecisionRepository
  implements FileRetentionDecisionRepository
{
  async findCase(clientCaseId: string): Promise<RetentionCase | null> {
    const prisma = getPrismaClient();
    return prisma.clientCase.findUnique({
      where: { id: clientCaseId },
      select: {
        id: true,
        clientId: true,
        status: true,
        closedAt: true,
      },
    });
  }

  async findDecision(clientCaseId: string): Promise<RetentionDecision | null> {
    const prisma = getPrismaClient();
    return prisma.clientCaseFileRetentionDecision.findUnique({
      where: { clientCaseId },
      select: {
        clientCaseId: true,
        requestedByUserId: true,
        choice: true,
        policyVersion: true,
        procedureCompletedAt: true,
        deleteAt: true,
        decidedAt: true,
      },
    });
  }

  async saveDecision(decision: RetentionDecision): Promise<RetentionDecision> {
    const prisma = getPrismaClient();
    return prisma.clientCaseFileRetentionDecision.upsert({
      where: { clientCaseId: decision.clientCaseId },
      create: decision,
      update: {},
      select: {
        clientCaseId: true,
        requestedByUserId: true,
        choice: true,
        policyVersion: true,
        procedureCompletedAt: true,
        deleteAt: true,
        decidedAt: true,
      },
    });
  }
}
