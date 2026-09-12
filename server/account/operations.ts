import "server-only";

import type { SessionProvider } from "@/server/auth/contracts";
import { requireServerActor } from "@/server/auth/runtime";
import { getPrismaClient } from "@/server/database/prisma";

export const ACCOUNT_PROFILE_NOT_FOUND = "ACCOUNT_PROFILE_NOT_FOUND";
export const ACCOUNT_PROFILE_INVALID_DISPLAY_NAME = "ACCOUNT_PROFILE_INVALID_DISPLAY_NAME";
export const ACCOUNT_PROFILE_INVALID_EMAIL = "ACCOUNT_PROFILE_INVALID_EMAIL";
export const ACCOUNT_PROFILE_INVALID_PHONE = "ACCOUNT_PROFILE_INVALID_PHONE";
export const ACCOUNT_PROFILE_EMAIL_CONFLICT = "ACCOUNT_PROFILE_EMAIL_CONFLICT";

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

function normalizeContactEmail(value: unknown) {
  if (typeof value !== "string") throw new Error(ACCOUNT_PROFILE_INVALID_EMAIL);
  const email = value.trim().toLowerCase();
  if (
    email.length < 3 ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    throw new Error(ACCOUNT_PROFILE_INVALID_EMAIL);
  }
  return email;
}

function normalizeContactPhone(value: unknown) {
  if (typeof value !== "string") throw new Error(ACCOUNT_PROFILE_INVALID_PHONE);
  const trimmed = value.trim();
  if (!trimmed) return null;
  const phone = trimmed.replace(/[\s().-]/g, "");
  if (!/^\+?\d{7,15}$/.test(phone)) throw new Error(ACCOUNT_PROFILE_INVALID_PHONE);
  return phone;
}

export async function updateCurrentAccountContacts(
  sessionProvider: SessionProvider,
  input: { email?: unknown; phone?: unknown },
): Promise<{ email: string | null; phone: string | null }> {
  const actor = await requireServerActor(sessionProvider);
  const data: { email?: string; phone?: string | null } = {};

  if (Object.prototype.hasOwnProperty.call(input, "email")) {
    data.email = normalizeContactEmail(input.email);
  }
  if (Object.prototype.hasOwnProperty.call(input, "phone")) {
    data.phone = normalizeContactPhone(input.phone);
  }
  if (!Object.keys(data).length) throw new Error(ACCOUNT_PROFILE_INVALID_EMAIL);

  try {
    return await getPrismaClient().user.update({
      where: { id: actor.userId },
      data,
      select: { email: true, phone: true },
    });
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002"
    ) {
      throw new Error(ACCOUNT_PROFILE_EMAIL_CONFLICT);
    }
    throw error;
  }
}
