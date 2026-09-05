import { createHmac } from "node:crypto";

export type StagingAuthFlowGuardInput = {
  runtimeTarget: string | undefined;
  authFlowTarget: string | undefined;
  confirmation: string | undefined;
  host: string;
};

export type StagingAuthFlowGuardDecision =
  | { allowed: true; code: "ALLOWED" }
  | {
      allowed: false;
      code:
        | "RUNTIME_TARGET_NOT_STAGING"
        | "AUTH_FLOW_TARGET_NOT_STAGING"
        | "PRODUCTION_HOST_BLOCKED"
        | "CONFIRMATION_MISMATCH";
    };

function normalizedHostnameFromHost(host: string): string {
  const trimmed = host.trim();
  try {
    return new URL(`https://${trimmed}`).hostname.toLowerCase().replace(/\.+$/, "");
  } catch {
    return trimmed.toLowerCase().replace(/\.+$/, "").replace(/:\d+$/, "");
  }
}

function isProductionHostname(host: string): boolean {
  const hostname = normalizedHostnameFromHost(host);
  return hostname === "iburo127.ru" || hostname.endsWith(".iburo127.ru");
}

export function evaluateStagingAuthFlowGuard(
  input: StagingAuthFlowGuardInput,
): StagingAuthFlowGuardDecision {
  if (input.runtimeTarget?.trim() !== "staging") {
    return { allowed: false, code: "RUNTIME_TARGET_NOT_STAGING" };
  }
  if (input.authFlowTarget?.trim() !== "staging") {
    return { allowed: false, code: "AUTH_FLOW_TARGET_NOT_STAGING" };
  }
  if (isProductionHostname(input.host)) {
    return { allowed: false, code: "PRODUCTION_HOST_BLOCKED" };
  }
  if (input.confirmation?.trim() !== `AUTH-FLOW:${input.host}`) {
    return { allowed: false, code: "CONFIRMATION_MISMATCH" };
  }
  return { allowed: true, code: "ALLOWED" };
}

function decodeBase32(secret: string): Buffer {
  const normalized = secret.toUpperCase().replace(/\s+/g, "").replace(/=+$/g, "");
  if (!normalized || !/^[A-Z2-7]+$/.test(normalized)) {
    throw new Error("INVALID_TOTP_SECRET");
  }

  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const output: number[] = [];
  let buffer = 0;
  let bits = 0;

  for (const character of normalized) {
    const value = alphabet.indexOf(character);
    if (value < 0) throw new Error("INVALID_TOTP_SECRET");
    buffer = (buffer << 5) | value;
    bits += 5;

    while (bits >= 8) {
      bits -= 8;
      output.push((buffer >>> bits) & 0xff);
      buffer &= bits === 0 ? 0 : (1 << bits) - 1;
    }
  }

  if (output.length === 0) throw new Error("INVALID_TOTP_SECRET");
  return Buffer.from(output);
}

export function generateTotp(
  secret: string,
  options: {
    timestampMs?: number;
    periodSeconds?: number;
    digits?: number;
  } = {},
): string {
  const timestampMs = options.timestampMs ?? Date.now();
  const periodSeconds = options.periodSeconds ?? 30;
  const digits = options.digits ?? 6;

  if (!Number.isFinite(timestampMs) || timestampMs < 0) {
    throw new Error("INVALID_TOTP_TIMESTAMP");
  }
  if (!Number.isInteger(periodSeconds) || periodSeconds <= 0) {
    throw new Error("INVALID_TOTP_PERIOD");
  }
  if (!Number.isInteger(digits) || digits < 6 || digits > 8) {
    throw new Error("INVALID_TOTP_DIGITS");
  }

  const counter = BigInt(Math.floor(timestampMs / 1000 / periodSeconds));
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(counter);

  const digest = createHmac("sha1", decodeBase32(secret)).update(counterBuffer).digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  const binary =
    ((digest[offset]! & 0x7f) << 24) |
    ((digest[offset + 1]! & 0xff) << 16) |
    ((digest[offset + 2]! & 0xff) << 8) |
    (digest[offset + 3]! & 0xff);
  const code = binary % 10 ** digits;
  return String(code).padStart(digits, "0");
}

export class StagingCookieJar {
  private readonly cookies = new Map<string, string>();

  absorb(headers: Headers): void {
    const candidate = headers as Headers & { getSetCookie?: () => string[] };
    if (typeof candidate.getSetCookie !== "function") {
      throw new Error("SET_COOKIE_READER_UNAVAILABLE");
    }
    this.absorbSetCookieLines(candidate.getSetCookie());
  }

  absorbSetCookieLines(lines: readonly string[]): void {
    for (const line of lines) {
      const [pair, ...attributes] = line.split(";");
      if (!pair) continue;
      const separator = pair.indexOf("=");
      if (separator <= 0) continue;

      const name = pair.slice(0, separator).trim();
      const value = pair.slice(separator + 1).trim();
      const deleteCookie =
        !value ||
        attributes.some((attribute) => /^\s*max-age\s*=\s*0\s*$/i.test(attribute));

      if (deleteCookie) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
  }

  header(): string {
    return [...this.cookies.entries()]
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
  }

  get hasCookies(): boolean {
    return this.cookies.size > 0;
  }

  clear(): void {
    this.cookies.clear();
  }
}
