export const PLATFORM_ROLE_CODES = ["CLIENT", "LAWYER", "MANAGER"] as const;

export type ActorRole = (typeof PLATFORM_ROLE_CODES)[number];

export type AuthenticatedActor = {
  userId: string;
  roles: readonly ActorRole[];
};

export type ClientCaseAccessScope = {
  actor: AuthenticatedActor;
  caseId?: string;
  caseNumber?: string;
};

export type ClientCaseRecord = {
  id: string;
  caseNumber: string;
  clientId: string;
  planCode: string;
  stageCode: string;
  assignedLawyerId: string | null;
  status: "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED" | "ARCHIVED";
};

export interface ClientCaseRepository {
  findAccessibleCase(scope: ClientCaseAccessScope): Promise<ClientCaseRecord | null>;
  listAccessibleCases(actor: AuthenticatedActor): Promise<readonly ClientCaseRecord[]>;
}

export function hasRole(actor: AuthenticatedActor, role: ActorRole) {
  return actor.roles.includes(role);
}
