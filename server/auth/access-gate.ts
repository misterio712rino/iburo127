import "server-only";

import { getPrismaClient } from "@/server/database/prisma";
import { readBetterAuthRuntimeConfig } from "@/server/config/production";
import {
  issueAccessChallenge,
  normalizeAccessIdentifier,
  verifyAccessChallenge,
  type AccessIdentifier,
} from "@/server/auth/access-gate-core";

const BETTER_AUTH_PROVIDER = "better-auth";
const LEAD_SOURCE = "AUTH_GATE";

type UserAccessState = {
  id: string;
  email: string | null;
  status: string;
  roles: Array<{ role: { code: string } }>;
  authIdentities: Array<{ provider: string }>;
};

async function loadUserAccessState(userId: string): Promise<UserAccessState | null> {
  const prisma = getPrismaClient();
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      status: true,
      roles: { select: { role: { select: { code: true } } } },
      authIdentities: { select: { provider: true } },
    },
  });
}

async function findUserIds(identifier: AccessIdentifier): Promise<string[]> {
  const prisma = getPrismaClient();
  if (identifier.type === "EMAIL") {
    const rows = await prisma.user.findMany({
      where: {
        email: { equals: identifier.email, mode: "insensitive" },
      },
      select: { id: true },
      take: 2,
    });
    return rows.map((row) => row.id);
  }

  const digits = identifier.phone.replace(/\D/g, "");
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    select id::text as id
    from "User"
    where regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g') = ${digits}
    order by id
    limit 2
  `;
  return rows.map((row) => row.id);
}

function isLoginReady(user: UserAccessState | null): user is UserAccessState & { email: string } {
  return Boolean(
    user &&
      user.status === "ACTIVE" &&
      user.email &&
      user.roles.length > 0 &&
      user.authIdentities.some((identity) => identity.provider === BETTER_AUTH_PROVIDER),
  );
}

async function recordProspect(identifier: AccessIdentifier): Promise<void> {
  const prisma = getPrismaClient();
  const now = new Date();
  await prisma.potentialClientLead.upsert({
    where: { contactKey: identifier.contactKey },
    create: {
      contactType: identifier.type,
      contactKey: identifier.contactKey,
      email: identifier.email,
      phone: identifier.phone,
      source: LEAD_SOURCE,
      firstSeenAt: now,
      lastSeenAt: now,
    },
    update: {
      email: identifier.email,
      phone: identifier.phone,
      source: LEAD_SOURCE,
      status: "NEW",
      attemptCount: { increment: 1 },
      lastSeenAt: now,
    },
  });
}

async function markLeadConverted(contactKey: string): Promise<void> {
  const prisma = getPrismaClient();
  await prisma.potentialClientLead.updateMany({
    where: { contactKey, status: "NEW" },
    data: { status: "CONVERTED", lastSeenAt: new Date() },
  });
}

export type AccessGateResult =
  | { state: "LOGIN"; challenge: string }
  | { state: "PROSPECT"; purchaseUrl: "https://iburo127.ru/" }
  | { state: "ACCOUNT_UNAVAILABLE" };

export async function evaluateAccessIdentifier(rawIdentifier: unknown): Promise<AccessGateResult> {
  const identifier = normalizeAccessIdentifier(rawIdentifier);
  const userIds = await findUserIds(identifier);

  if (userIds.length === 0) {
    await recordProspect(identifier);
    return { state: "PROSPECT", purchaseUrl: "https://iburo127.ru/" };
  }

  if (userIds.length !== 1) {
    return { state: "ACCOUNT_UNAVAILABLE" };
  }

  const user = await loadUserAccessState(userIds[0]!);
  if (!isLoginReady(user)) {
    return { state: "ACCOUNT_UNAVAILABLE" };
  }

  await markLeadConverted(identifier.contactKey);
  const { secret } = readBetterAuthRuntimeConfig();
  return {
    state: "LOGIN",
    challenge: issueAccessChallenge({ userId: user.id, secret }),
  };
}

export async function resolveAccessChallengeToEmail(rawChallenge: unknown): Promise<string> {
  const { secret } = readBetterAuthRuntimeConfig();
  const payload = verifyAccessChallenge({ challenge: rawChallenge, secret });
  const user = await loadUserAccessState(payload.sub);
  if (!isLoginReady(user)) throw new Error("ACCESS_GATE_ACCOUNT_UNAVAILABLE");
  return user.email;
}
