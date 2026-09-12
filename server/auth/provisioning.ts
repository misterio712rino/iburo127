import "server-only";

import { getPrismaClient } from "@/server/database/prisma";

export const AUTH_IDENTITY_PROVISIONING_INVALID_INPUT = "AUTH_IDENTITY_PROVISIONING_INVALID_INPUT";
export const AUTH_IDENTITY_PROVISIONING_USER_NOT_FOUND = "AUTH_IDENTITY_PROVISIONING_USER_NOT_FOUND";
export const AUTH_IDENTITY_PROVISIONING_CONFLICT = "AUTH_IDENTITY_PROVISIONING_CONFLICT";

export type ProvisionAuthIdentityInput = {
  userId: string;
  provider: string;
  subject: string;
};

function normalizeRequired(value: string) {
  const normalized = value.trim();
  if (!normalized) throw new Error(AUTH_IDENTITY_PROVISIONING_INVALID_INPUT);
  return normalized;
}

/**
 * Controlled server-side provisioning primitive.
 *
 * This is intentionally NOT exposed as a public API route. Callers must be
 * trusted administrative tooling after the internal User row and verified
 * Better Auth subject are known. Email matching is deliberately unsupported.
 */
export async function provisionAuthIdentity(input: ProvisionAuthIdentityInput) {
  const userId = normalizeRequired(input.userId);
  const provider = normalizeRequired(input.provider);
  const subject = normalizeRequired(input.subject);
  const prisma = getPrismaClient();

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { id: true, status: true },
    });
    if (!user || user.status !== "ACTIVE") {
      throw new Error(AUTH_IDENTITY_PROVISIONING_USER_NOT_FOUND);
    }

    const existing = await tx.authIdentity.findUnique({
      where: { provider_subject: { provider, subject } },
      select: { id: true, userId: true, provider: true, subject: true },
    });

    if (existing) {
      if (existing.userId !== user.id) {
        throw new Error(AUTH_IDENTITY_PROVISIONING_CONFLICT);
      }
      return existing;
    }

    return tx.authIdentity.create({
      data: { userId: user.id, provider, subject },
      select: { id: true, userId: true, provider: true, subject: true },
    });
  });
}
