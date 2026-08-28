import "server-only";

import type { ActorRepository } from "@/server/auth/contracts";
import {
  PLATFORM_ROLE_CODES,
  type ActorRole,
  type AuthenticatedActor,
} from "@/server/domain/client-cases/contracts";
import { getPrismaClient } from "@/server/database/prisma";

const PLATFORM_ROLES = new Set<ActorRole>(PLATFORM_ROLE_CODES);

export class PrismaActorRepository implements ActorRepository {
  async getActiveActor(userId: string): Promise<AuthenticatedActor | null> {
    const prisma = getPrismaClient();

    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        status: "ACTIVE",
      },
      select: {
        id: true,
        roles: {
          select: {
            role: {
              select: { code: true },
            },
          },
        },
      },
    });

    if (!user) return null;

    const roles = user.roles
      .map(({ role }) => role.code)
      .filter((code): code is ActorRole => PLATFORM_ROLES.has(code as ActorRole));

    return {
      userId: user.id,
      roles,
    };
  }
}
