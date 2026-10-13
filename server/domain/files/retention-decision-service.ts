import type { AuthenticatedActor } from "@/server/domain/client-cases/contracts";
import {
  createAuthorizedFileRetentionSchedule,
  type RetentionChoice,
} from "@/server/domain/files/retention-policy";

export const RETENTION_CASE_NOT_FOUND = "RETENTION_CASE_NOT_FOUND";
export const RETENTION_DECISION_CONFLICT = "RETENTION_DECISION_CONFLICT";

export type RetentionCase = {
  id: string;
  clientId: string;
  status: string;
  closedAt: Date | null;
};

export type RetentionDecision = {
  clientCaseId: string;
  requestedByUserId: string;
  choice: RetentionChoice;
  policyVersion: string;
  procedureCompletedAt: Date;
  deleteAt: Date;
  decidedAt: Date;
};

export interface FileRetentionDecisionRepository {
  findCase(clientCaseId: string): Promise<RetentionCase | null>;
  findDecision(clientCaseId: string): Promise<RetentionDecision | null>;
  saveDecision(decision: RetentionDecision): Promise<RetentionDecision>;
}

export class FileRetentionDecisionService {
  constructor(private readonly repository: FileRetentionDecisionRepository) {}

  async decide(input: {
    actor: AuthenticatedActor;
    clientCaseId: string;
    choice: RetentionChoice;
    decidedAt?: Date;
  }): Promise<RetentionDecision> {
    const isClient = input.actor.roles.includes("CLIENT");
    const isStaff =
      input.actor.roles.includes("LAWYER") || input.actor.roles.includes("MANAGER");
    if (!isClient || isStaff) throw new Error("RETENTION_FORBIDDEN");

    const clientCase = await this.repository.findCase(input.clientCaseId);
    if (!clientCase) throw new Error(RETENTION_CASE_NOT_FOUND);

    const schedule = createAuthorizedFileRetentionSchedule({
      actor: input.actor,
      clientCase,
      choice: input.choice,
      decidedAt: input.decidedAt ?? new Date(),
    });

    const existing = await this.repository.findDecision(clientCase.id);
    if (existing) {
      if (
        existing.requestedByUserId === input.actor.userId &&
        existing.choice === input.choice
      ) {
        return existing;
      }
      throw new Error(RETENTION_DECISION_CONFLICT);
    }

    const decision = await this.repository.saveDecision({
      clientCaseId: clientCase.id,
      requestedByUserId: input.actor.userId,
      choice: input.choice,
      policyVersion: schedule.policyVersion,
      procedureCompletedAt: clientCase.closedAt!,
      deleteAt: schedule.deleteAt,
      decidedAt: input.decidedAt ?? new Date(),
    });

    // The repository uses an immutable upsert, so a concurrent retry can only
    // return the first saved decision. Never report a different choice as accepted.
    if (
      decision.requestedByUserId !== input.actor.userId ||
      decision.choice !== input.choice
    ) {
      throw new Error(RETENTION_DECISION_CONFLICT);
    }
    return decision;
  }
}
