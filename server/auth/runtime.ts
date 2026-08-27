import "server-only";

import type { SessionProvider } from "@/server/auth/contracts";
import { resolveAuthenticatedActor } from "@/server/auth/contracts";
import { PrismaActorRepository } from "@/server/repositories/prisma/actor-repository";

export const UNAUTHENTICATED = "UNAUTHENTICATED";

const actorRepository = new PrismaActorRepository();

export async function resolveServerActor(sessionProvider: SessionProvider) {
  return resolveAuthenticatedActor(sessionProvider, actorRepository);
}

export async function requireServerActor(sessionProvider: SessionProvider) {
  const actor = await resolveServerActor(sessionProvider);
  if (!actor) {
    throw new Error(UNAUTHENTICATED);
  }
  return actor;
}
