import "server-only";

import { createHmac, randomUUID } from "node:crypto";
import { isIP } from "node:net";
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
const RATE_LIMIT_WINDOW_SECONDS = 15 * 60;
const RATE_LIMIT_IP_MAX = 30;
const RATE_LIMIT_CONTACT_MAX = 6;
const RATE_LIMIT_KEY_PREFIX = "iburo:access-gate:v1";

type UserAccessState = {
  id: string;
  email: string | null;
  status: string;
  roles: Array<{ role: { code: string } }>;
  authIdentities: Array<{ provider: string }>;
};

type RateLimitRow = {
  count: number | bigint;
};

export class AccessGateRateLimitError extends Error {
  readonly retryAfterSeconds = RATE_LIMIT_WINDOW_SECONDS;

  constructor() {
    super("ACCESS_GATE_RATE_LIMITED");
    this.name = "AccessGateRateLimitError";
  }
}

function rateLimitDigest(scope: "ip" | "contact", value: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(`${RATE_LIMIT_KEY_PREFIX}:${scope}:${value}`, "utf8")
    .digest("hex");
}

function readTrustedClientIp(request: Request): string {
  const raw = request.headers.get("x-forwarded-for")?.trim() ?? "";
  const first = raw.split(",", 1)[0]?.trim() ?? "";
  if (isIP(first) === 0) throw new Error("ACCESS_GATE_CLIENT_IP_UNAVAILABLE");
  return first;
}

async function consumeRateLimit(input: {
  key: string;
  limit: number;
  nowSeconds: number;
}): Promise<void> {
  const prisma = getPrismaClient();
  const windowStart = input.nowSeconds - RATE_LIMIT_WINDOW_SECONDS;
  const rows = await prisma.$queryRaw<RateLimitRow[]>`
    insert into "rateLimit" ("id", "key", "count", "lastRequest")
    values (${randomUUID()}, ${input.key}, 1, ${input.nowSeconds})
    on conflict ("key") do update
    set
      "count" = case
        when "rateLimit"."lastRequest" < ${windowStart} then 1
        else "rateLimit"."count" + 1
      end,
      "lastRequest" = case
        when "rateLimit"."lastRequest" < ${windowStart} then ${input.nowSeconds}
        else "rateLimit"."lastRequest"
      end
    returning "count"
  `;

  const count = Number(rows[0]?.count ?? Number.POSITIVE_INFINITY);
  if (!Number.isSafeInteger(count) || count > input.limit) {
    throw new AccessGateRateLimitError();
  }
}

async function enforceAccessGateRateLimit(
  request: Request,
  identifier: AccessIdentifier,
): Promise<void> {
  const { secret } = readBetterAuthRuntimeConfig();
  const clientIp = readTrustedClientIp(request);
  const nowSeconds = Math.floor(Date.now() / 1000);

  await consumeRateLimit({
    key: rateLimitDigest("ip", clientIp, secret),
    limit: RATE_LIMIT_IP_MAX,
    nowSeconds,
  });
  await consumeRateLimit({
    key: rateLimitDigest("contact", identifier.contactKey, secret),
    limit: RATE_LIMIT_CONTACT_MAX,
    nowSeconds,
  });
}

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

export async function evaluateAccessIdentifier(
  request: Request,
  rawIdentifier: unknown,
): Promise<AccessGateResult> {
  const identifier = normalizeAccessIdentifier(rawIdentifier);
  await enforceAccessGateRateLimit(request, identifier);
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
