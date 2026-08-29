import "server-only";

import { BetterAuthExternalSessionReader } from "@/server/auth/better-auth-session-reader";
import { createBetterAuthNextSessionLoader } from "@/server/auth/better-auth-next-session";
import { getBetterAuthInstance } from "@/server/auth/better-auth-instance";
import { createMappedSessionProvider } from "@/server/auth/provider-runtime";
import {
  isStaffActor,
  StaffMfaEnforcingSessionProvider,
} from "@/server/auth/staff-mfa-policy";
import { PrismaActorRepository } from "@/server/repositories/prisma/actor-repository";

const actorRepository = new PrismaActorRepository();

type ProductionAuthContext = ReturnType<typeof createProductionAuthContext>;

function createProductionAuthContext() {
  const auth = getBetterAuthInstance();
  const loader = createBetterAuthNextSessionLoader(auth.api);
  const baseSessionProvider = createMappedSessionProvider(
    new BetterAuthExternalSessionReader(loader),
  );
  const readMfaEnabled = async () => (await loader())?.user.twoFactorEnabled === true;

  return {
    baseSessionProvider,
    readMfaEnabled,
  };
}

export function createProductionSessionProvider() {
  const context = createProductionAuthContext();
  return new StaffMfaEnforcingSessionProvider(
    context.baseSessionProvider,
    actorRepository,
    context.readMfaEnabled,
  );
}

export type ProductionAccountSecurityState =
  | { status: "UNAUTHENTICATED" }
  | {
      status: "AUTHENTICATED";
      staff: boolean;
      twoFactorEnabled: boolean;
    };

export async function resolveProductionAccountSecurityState(): Promise<ProductionAccountSecurityState> {
  const context: ProductionAuthContext = createProductionAuthContext();
  const session = await context.baseSessionProvider.getSession();
  if (!session) return { status: "UNAUTHENTICATED" };

  const actor = await actorRepository.getActiveActor(session.userId);
  if (!actor) return { status: "UNAUTHENTICATED" };

  return {
    status: "AUTHENTICATED",
    staff: isStaffActor(actor),
    twoFactorEnabled: await context.readMfaEnabled(),
  };
}

export type ProductionStaffMfaState =
  | { status: "UNAUTHENTICATED" }
  | { status: "NOT_REQUIRED" }
  | { status: "REQUIRED" }
  | { status: "SATISFIED" };

export async function resolveProductionStaffMfaState(): Promise<ProductionStaffMfaState> {
  const state = await resolveProductionAccountSecurityState();
  if (state.status === "UNAUTHENTICATED") return state;
  if (!state.staff) return { status: "NOT_REQUIRED" };

  return state.twoFactorEnabled
    ? { status: "SATISFIED" }
    : { status: "REQUIRED" };
}
