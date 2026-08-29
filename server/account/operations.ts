import "server-only";

import type { SessionProvider } from "@/server/auth/contracts";
import { requireServerActor } from "@/server/auth/runtime";
import { getPrismaClient } from "@/server/database/prisma";

export const ACCOUNT_PROFILE_NOT_FOUND = "ACCOUNT_PROFILE_NOT_FOUND";

export type CurrentAccountProfile = {
  displayName: string | null;
  email: string | null;
  phone: string | null;
  roles: readonly ("CLIENT" | "LAWYER" | "MANAGER")[];
  createdAt: Date;
};

export async function getCurrentAccountProfile(
  sessionProvider: SessionProvider,
): Promise<CurrentAccountProfile> {
  const actor = await requireServerActor(sessionProvider);
  const prisma = getPrismaClient();

  const user = await prisma.user.findUnique({
    where: { id: actor.userId },
    select: {
      displayName: true,
      email: true,
      phone: true,
      createdAt: true,
    },
  });

  if (!user) throw new Error(ACCOUNT_PROFILE_NOT_FOUND);

  return {
    ...user,
    roles: actor.roles,
  };
}
