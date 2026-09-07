import type { AuthenticatedActor } from "@/server/domain/client-cases/contracts";
import { ClientCaseService } from "@/server/domain/client-cases/service";
import type {
  ActivityMetadata,
  CaseActivityRepository,
} from "@/server/domain/activity/contracts";
import {
  requireCaseActivityType,
  sanitizeActivityMetadata,
} from "@/server/domain/activity/taxonomy";

export const ACTIVITY_CASE_NOT_FOUND = "ACTIVITY_CASE_NOT_FOUND";

function normalizeLimit(limit?: number) {
  if (limit === undefined) return 50;
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) return 50;
  return limit;
}

export class CaseActivityService {
  constructor(
    private readonly cases: ClientCaseService,
    private readonly repository: CaseActivityRepository,
  ) {}

  private async requireAccessibleCase(actor: AuthenticatedActor, clientCaseId: string) {
    const clientCase = await this.cases.getCase(actor, { caseId: clientCaseId });
    if (!clientCase) throw new Error(ACTIVITY_CASE_NOT_FOUND);
    return clientCase;
  }

  async list(actor: AuthenticatedActor, clientCaseId: string, limit?: number) {
    await this.requireAccessibleCase(actor, clientCaseId);
    return this.repository.listByCase(clientCaseId, normalizeLimit(limit));
  }

  async appendForActor(
    actor: AuthenticatedActor,
    input: { clientCaseId: string; type: string; metadata?: ActivityMetadata },
  ) {
    await this.requireAccessibleCase(actor, input.clientCaseId);
    return this.repository.append({
      clientCaseId: input.clientCaseId,
      actorUserId: actor.userId,
      type: requireCaseActivityType(input.type),
      metadata: sanitizeActivityMetadata(input.metadata),
    });
  }

  async appendSystem(input: {
    clientCaseId: string;
    type: string;
    metadata?: ActivityMetadata;
  }) {
    return this.repository.append({
      clientCaseId: input.clientCaseId,
      actorUserId: null,
      type: requireCaseActivityType(input.type),
      metadata: sanitizeActivityMetadata(input.metadata),
    });
  }
}
