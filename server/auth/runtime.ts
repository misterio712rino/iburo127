import "server-only";

import type { SessionProvider } from "@/server/auth/contracts";
import { resolveAuthenticatedActor } from "@/server/auth/contracts";
import { PrismaActorRepository } from "@/server/repositories/prisma/actor-repository";

const actorRepository = new PrismaActorRepository();

export async function resolveServerActor(sessionProvider: SessionProvider) {
  return resolveAuthenticatedActor(sessionProvider, actorRepository);
}
