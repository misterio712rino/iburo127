import { clientPlanHasHumanSupport } from "@/lib/platform/client-plan-entitlements";
import type { AuthenticatedActor, ClientCaseRecord } from "./contracts";

export function canAccessClientCaseAsStaff(
  actor: AuthenticatedActor,
  clientCase: ClientCaseRecord,
) {
  if (clientCase.clientId === actor.userId) return false;
  if (actor.roles.includes("MANAGER")) return true;
  if (
    actor.roles.includes("LAWYER") &&
    clientPlanHasHumanSupport(clientCase.planCode) &&
    clientCase.assignedLawyerId === actor.userId
  ) {
    return true;
  }
  return false;
}

export function canAccessClientCase(actor: AuthenticatedActor, clientCase: ClientCaseRecord) {
  if (actor.roles.includes("MANAGER")) return true;
  if (
    actor.roles.includes("LAWYER") &&
    clientPlanHasHumanSupport(clientCase.planCode) &&
    clientCase.assignedLawyerId === actor.userId
  ) {
    return true;
  }
  if (actor.roles.includes("CLIENT") && clientCase.clientId === actor.userId) return true;
  return false;
}
