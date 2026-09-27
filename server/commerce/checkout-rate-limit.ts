import "server-only";

import { createHmac, randomUUID } from "node:crypto";
import { isIP } from "node:net";

import { readBetterAuthRuntimeConfig } from "@/server/config/production";
import { getPrismaClient } from "@/server/database/prisma";

export const COMMERCE_CHECKOUT_RATE_LIMIT_WINDOW_SECONDS = 15 * 60;
export const COMMERCE_CHECKOUT_RATE_LIMIT_MAX = 8;
const COMMERCE_CHECKOUT_RATE_LIMIT_KEY_PREFIX = "iburo:commerce-checkout:v1";

type RateLimitRow = {
  count: number | bigint;
};

export class CommerceCheckoutRateLimitError extends Error {
  readonly retryAfterSeconds = COMMERCE_CHECKOUT_RATE_LIMIT_WINDOW_SECONDS;

  constructor() {
    super("COMMERCE_CHECKOUT_RATE_LIMITED");
    this.name = "CommerceCheckoutRateLimitError";
  }
}

function readTrustedClientIp(request: Request): string {
  const raw = request.headers.get("x-forwarded-for")?.trim() ?? "";
  const first = raw.split(",", 1)[0]?.trim() ?? "";
  if (isIP(first) === 0) throw new Error("COMMERCE_CHECKOUT_CLIENT_IP_UNAVAILABLE");
  return first;
}

function rateLimitKey(clientIp: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(`${COMMERCE_CHECKOUT_RATE_LIMIT_KEY_PREFIX}:${clientIp}`, "utf8")
    .digest("hex");
}

export async function enforceCommerceCheckoutRateLimit(request: Request): Promise<void> {
  const clientIp = readTrustedClientIp(request);
  const { secret } = readBetterAuthRuntimeConfig();
  const key = rateLimitKey(clientIp, secret);
  const nowMs = Date.now();
  const windowStartMs = nowMs - COMMERCE_CHECKOUT_RATE_LIMIT_WINDOW_SECONDS * 1000;
  const prisma = getPrismaClient();

  const rows = await prisma.$queryRaw<RateLimitRow[]>`
    insert into "rateLimit" ("id", "key", "count", "lastRequest")
    values (${randomUUID()}, ${key}, 1, ${nowMs})
    on conflict ("key") do update
    set
      "count" = case
        when "rateLimit"."lastRequest" < ${windowStartMs} then 1
        else "rateLimit"."count" + 1
      end,
      "lastRequest" = case
        when "rateLimit"."lastRequest" < ${windowStartMs} then ${nowMs}
        else "rateLimit"."lastRequest"
      end
    returning "count"
  `;

  const count = Number(rows[0]?.count ?? Number.POSITIVE_INFINITY);
  if (!Number.isSafeInteger(count) || count > COMMERCE_CHECKOUT_RATE_LIMIT_MAX) {
    throw new CommerceCheckoutRateLimitError();
  }
}
