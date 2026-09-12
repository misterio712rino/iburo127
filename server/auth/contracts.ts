import type { AuthenticatedActor, ActorRole } from "@/server/domain/client-cases/contracts";

export type AuthSession = {
  userId: string;
};

export interface SessionProvider {
  getSession(): Promise<AuthSession | null>;
}

export interface ActorRepository {
  getActiveActor(userId: string): Promise<AuthenticatedActor | null>;
}

export async function resolveAuthenticatedActor(
  sessionProvider: SessionProvider,
  actorRepository: ActorRepository,
): Promise<AuthenticatedActor | null> {
  const session = await sessionProvider.getSession();
  if (!session) return null;
  return actorRepository.getActiveActor(session.userId);
}

export function requireRole(actor: AuthenticatedActor, role: ActorRole) {
  if (!actor.roles.includes(role)) {
    throw new Error("FORBIDDEN");
  }
}
