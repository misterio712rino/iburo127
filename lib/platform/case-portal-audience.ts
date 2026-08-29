import type {
  AuthenticatedActor,
  ClientCaseRecord,
} from "@/server/domain/client-cases/contracts";

export type CasePortalAudience = "CLIENT" | "STAFF";

export const CASE_PORTAL_AUDIENCE_UNRESOLVED = "CASE_PORTAL_AUDIENCE_UNRESOLVED";

export function resolveCasePortalAudience(
  actor: AuthenticatedActor,
  clientCase: ClientCaseRecord,
): CasePortalAudience {
  if (actor.roles.includes("CLIENT") && clientCase.clientId === actor.userId) {
    return "CLIENT";
  }

  if (actor.roles.includes("LAWYER") || actor.roles.includes("MANAGER")) {
    return "STAFF";
  }

  throw new Error(CASE_PORTAL_AUDIENCE_UNRESOLVED);
}
