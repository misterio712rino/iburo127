import { createHmac, timingSafeEqual } from "node:crypto";

export type AccessIdentifier =
  | { type: "EMAIL"; normalized: string; contactKey: string; email: string; phone: null }
  | { type: "PHONE"; normalized: string; contactKey: string; email: null; phone: string };

type ChallengePayload = {
  v: 1;
  sub: string;
  exp: number;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_INPUT_PATTERN = /^[+()\-\s0-9]+$/;

export class AccessGateInputError extends Error {}

function fail(message: string): never {
  throw new AccessGateInputError(message);
}

function safeText(value: unknown): string {
  if (typeof value !== "string") fail("identifier must be a string");
  const normalized = value.trim();
  if (!normalized || normalized.length > 254 || /[\r\n\0]/.test(normalized)) {
    fail("identifier is invalid");
  }
  return normalized;
}

export function normalizeAccessIdentifier(value: unknown): AccessIdentifier {
  const input = safeText(value);
  if (input.includes("@")) {
    const email = input.toLowerCase();
    if (!EMAIL_PATTERN.test(email)) fail("email is invalid");
    return {
      type: "EMAIL",
      normalized: email,
      contactKey: `email:${email}`,
      email,
      phone: null,
    };
  }

  if (!PHONE_INPUT_PATTERN.test(input)) fail("phone is invalid");
  let digits = input.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("8")) digits = `7${digits.slice(1)}`;
  if (digits.length === 10) digits = `7${digits}`;
  if (digits.length < 10 || digits.length > 15) fail("phone is invalid");
  const phone = `+${digits}`;
  return {
    type: "PHONE",
    normalized: phone,
    contactKey: `phone:${phone}`,
    email: null,
    phone,
  };
}

function requireSecret(secret: string): string {
  if (secret.length < 32 || /[\r\n\0]/.test(secret)) fail("challenge secret is invalid");
  return secret;
}

function signature(payload: string, secret: string): string {
  return createHmac("sha256", requireSecret(secret)).update(payload).digest("base64url");
}

export function issueAccessChallenge(input: {
  userId: string;
  secret: string;
  nowMs?: number;
  ttlSeconds?: number;
}): string {
  if (!UUID_PATTERN.test(input.userId)) fail("challenge subject is invalid");
  const nowMs = input.nowMs ?? Date.now();
  const ttlSeconds = input.ttlSeconds ?? 300;
  if (!Number.isInteger(ttlSeconds) || ttlSeconds < 30 || ttlSeconds > 600) {
    fail("challenge ttl is invalid");
  }
  const payload: ChallengePayload = {
    v: 1,
    sub: input.userId.toLowerCase(),
    exp: Math.floor(nowMs / 1000) + ttlSeconds,
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encoded}.${signature(encoded, input.secret)}`;
}

export function verifyAccessChallenge(input: {
  challenge: unknown;
  secret: string;
  nowMs?: number;
}): ChallengePayload {
  if (typeof input.challenge !== "string" || input.challenge.length > 1024) {
    fail("challenge is invalid");
  }
  const parts = input.challenge.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) fail("challenge is invalid");
  const expected = signature(parts[0], input.secret);
  const actualBuffer = Buffer.from(parts[1], "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) {
    fail("challenge signature is invalid");
  }

  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
  } catch {
    fail("challenge payload is invalid");
  }
  if (
    !payload ||
    typeof payload !== "object" ||
    (payload as { v?: unknown }).v !== 1 ||
    typeof (payload as { sub?: unknown }).sub !== "string" ||
    !UUID_PATTERN.test((payload as { sub: string }).sub) ||
    !Number.isInteger((payload as { exp?: unknown }).exp)
  ) {
    fail("challenge payload is invalid");
  }
  const typed = payload as ChallengePayload;
  const nowSeconds = Math.floor((input.nowMs ?? Date.now()) / 1000);
  if (typed.exp <= nowSeconds) fail("challenge expired");
  if (typed.exp > nowSeconds + 600) fail("challenge expiry is invalid");
  return typed;
}
