import "server-only";

import type { SessionProvider } from "@/server/auth/contracts";
import { requireServerActor } from "@/server/auth/runtime";
import { getPrismaClient } from "@/server/database/prisma";

export const ACCOUNT_PROFILE_NOT_FOUND = "ACCOUNT_PROFILE_NOT_FOUND";
export const ACCOUNT_PROFILE_INVALID_DISPLAY_NAME = "ACCOUNT_PROFILE_INVALID_DISPLAY_NAME";

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

export async function updateCurrentAccountDisplayName(
  sessionProvider: SessionProvider,
  value: unknown,
): Promise<{ displayName: string }> {
  const actor = await requireServerActor(sessionProvider);
  if (typeof value !== "string") throw new Error(ACCOUNT_PROFILE_INVALID_DISPLAY_NAME);
  const displayName = value.trim().replace(/\s+/g, " ");
  if (displayName.length < 2 || displayName.length > 80) {
    throw new Error(ACCOUNT_PROFILE_INVALID_DISPLAY_NAME);
  }

  const user = await getPrismaClient().user.update({
    where: { id: actor.userId },
    data: { displayName },
    select: { displayName: true },
  });

  if (!user.displayName) throw new Error(ACCOUNT_PROFILE_NOT_FOUND);
  return { displayName: user.displayName };
}
