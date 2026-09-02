import { createHmac } from "node:crypto";
import { isIP } from "node:net";

export const ACCESS_GATE_RATE_LIMIT_KEY_PREFIX = "iburo:access-gate:v1";

export type AccessGateRateLimitScope = "ip" | "contact";

export function accessGateRateLimitDigest(
  scope: AccessGateRateLimitScope,
  value: string,
  secret: string,
): string {
  return createHmac("sha256", secret)
    .update(`${ACCESS_GATE_RATE_LIMIT_KEY_PREFIX}:${scope}:${value}`, "utf8")
    .digest("hex");
}

export function readTrustedAccessGateClientIp(request: Request): string {
  const raw = request.headers.get("x-forwarded-for")?.trim() ?? "";
  const first = raw.split(",", 1)[0]?.trim() ?? "";
  if (isIP(first) === 0) throw new Error("ACCESS_GATE_CLIENT_IP_UNAVAILABLE");
  return first;
}
