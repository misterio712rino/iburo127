import "server-only";

import { normalizeCourtCaseNumber } from "@/lib/platform/client-case-number";
import { UNAUTHENTICATED } from "@/server/auth/runtime";
import { privateJsonResponse } from "@/server/http/private-json";

export type PlatformActorTransport = {
  roles: readonly ("CLIENT" | "LAWYER" | "MANAGER")[];
};

export type ClientCaseTransportRecord = {
  id: string;
  caseNumber: string;
  planCode: string;
  stageCode: string;
  status: string;
};

export function toPlatformActorTransport(actor: {
  roles: readonly ("CLIENT" | "LAWYER" | "MANAGER")[];
}): PlatformActorTransport {
  return { roles: [...actor.roles] };
}

export function toClientCaseTransportRecord(clientCase: {
  id: string;
  caseNumber: string;
  planCode: string;
  stageCode: string;
  status: string;
}): ClientCaseTransportRecord {
  return {
    id: clientCase.id,
    caseNumber: normalizeCourtCaseNumber(clientCase.caseNumber) ?? "Номер дела ещё не присвоен",
    planCode: clientCase.planCode,
    stageCode: clientCase.stageCode,
    status: clientCase.status,
  };
}

export async function executePlatformIdentityOperation<T>(operation: () => Promise<T>): Promise<Response> {
  try {
    return privateJsonResponse({ ok: true, data: await operation() });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === UNAUTHENTICATED) {
      return privateJsonResponse({ ok: false, error: { code: "UNAUTHENTICATED" } }, 401);
    }
    return privateJsonResponse({ ok: false, error: { code: "INTERNAL_ERROR" } }, 500);
  }
}
