import "server-only";

import { getPrismaClient } from "@/server/database/prisma";
import type {
  AuthenticatedActor,
  ClientCaseAccessScope,
  ClientCaseRecord,
  ClientCaseRepository,
} from "@/server/domain/client-cases/contracts";

function actorAccessWhere(actor: AuthenticatedActor) {
  if (actor.roles.includes("MANAGER")) return {};

  const access: Array<{ clientId: string } | { assignedLawyerId: string }> = [];
  if (actor.roles.includes("CLIENT")) access.push({ clientId: actor.userId });
  if (actor.roles.includes("LAWYER")) access.push({ assignedLawyerId: actor.userId });

  return access.length ? { OR: access } : null;
}

function toRecord(clientCase: {
  id: string;
  caseNumber: string;
  clientId: string;
  assignedLawyerId: string | null;
  status: ClientCaseRecord["status"];
  plan: { code: string };
  stage: { code: string };
}): ClientCaseRecord {
  return {
    id: clientCase.id,
    caseNumber: clientCase.caseNumber,
    clientId: clientCase.clientId,
    planCode: clientCase.plan.code,
    stageCode: clientCase.stage.code,
    assignedLawyerId: clientCase.assignedLawyerId,
    status: clientCase.status,
  };
}

const caseSelect = {
  id: true,
  caseNumber: true,
  clientId: true,
  assignedLawyerId: true,
  status: true,
  plan: { select: { code: true } },
  stage: { select: { code: true } },
} as const;

export class PrismaClientCaseRepository implements ClientCaseRepository {
  async findAccessibleCase(scope: ClientCaseAccessScope): Promise<ClientCaseRecord | null> {
    const accessWhere = actorAccessWhere(scope.actor);
    if (!accessWhere || (!scope.caseId && !scope.caseNumber)) return null;

    const prisma = getPrismaClient();
    const clientCase = await prisma.clientCase.findFirst({
      where: {
        ...accessWhere,
        ...(scope.caseId ? { id: scope.caseId } : {}),
        ...(scope.caseNumber ? { caseNumber: scope.caseNumber } : {}),
      },
      select: caseSelect,
    });

    return clientCase ? toRecord(clientCase) : null;
  }

  async listAccessibleCases(actor: AuthenticatedActor): Promise<readonly ClientCaseRecord[]> {
    const accessWhere = actorAccessWhere(actor);
    if (!accessWhere) return [];

    const prisma = getPrismaClient();
    const cases = await prisma.clientCase.findMany({
      where: accessWhere,
      select: caseSelect,
      orderBy: { createdAt: "desc" },
    });

    return cases.map(toRecord);
  }
}
