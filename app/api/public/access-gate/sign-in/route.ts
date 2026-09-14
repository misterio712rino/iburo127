import { toNextJsHandler } from "better-auth/next-js";
import { getBetterAuthInstance } from "@/server/auth/better-auth-instance";
import { resolveAccessChallengeToEmail } from "@/server/auth/access-gate";
import { AccessGateInputError } from "@/server/auth/access-gate-core";
import { readBoundedJsonBody } from "@/server/http/bounded-json-body";
import { privateJsonResponse } from "@/server/http/private-json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function readPassword(value: unknown): string | null {
  if (typeof value !== "string" || value.length < 12 || value.length > 128 || /[\r\n\0]/.test(value)) {
    return null;
  }
  return value;
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return privateJsonResponse({ ok: false, error: { code: "FORBIDDEN_ORIGIN" } }, 403);
  }

  const bodyResult = await readBoundedJsonBody(request, 8 * 1024);
  if (!bodyResult.ok) return bodyResult.response;
  const body = bodyResult.value;
  if (!body || typeof body !== "object") {
    return privateJsonResponse({ ok: false, error: { code: "INVALID_CREDENTIALS" } }, 400);
  }

  const password = readPassword((body as { password?: unknown }).password);
  if (!password) {
    return privateJsonResponse({ ok: false, error: { code: "INVALID_CREDENTIALS" } }, 400);
  }

  let email: string;
  try {
    email = await resolveAccessChallengeToEmail((body as { challenge?: unknown }).challenge);
  } catch (error) {
    if (error instanceof AccessGateInputError || (error instanceof Error && error.message === "ACCESS_GATE_ACCOUNT_UNAVAILABLE")) {
      return privateJsonResponse({ ok: false, error: { code: "ACCESS_CHALLENGE_INVALID" } }, 401);
    }
    return privateJsonResponse({ ok: false, error: { code: "ACCESS_GATE_UNAVAILABLE" } }, 503);
  }

  const headers = new Headers(request.headers);
  headers.set("content-type", "application/json");
  headers.delete("content-length");
  const target = new URL("/api/auth/sign-in/email", request.url);
  const internalRequest = new Request(target, {
    method: "POST",
    headers,
    body: JSON.stringify({ email, password }),
    redirect: "manual",
  });

  return toNextJsHandler(getBetterAuthInstance()).POST(internalRequest);
}
