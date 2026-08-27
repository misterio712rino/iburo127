import type { AuthenticatedActor, ClientCaseRecord } from "./contracts";

export function canAccessClientCase(actor: AuthenticatedActor, clientCase: ClientCaseRecord) {
  if (actor.roles.includes("MANAGER")) return true;
  if (actor.roles.includes("LAWYER") && clientCase.assignedLawyerId === actor.userId) return true;
  if (actor.roles.includes("CLIENT") && clientCase.clientId === actor.userId) return true;
  return false;
}
