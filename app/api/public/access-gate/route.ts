import { evaluateAccessIdentifier } from "@/server/auth/access-gate";
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

export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return privateJsonResponse({ ok: false, error: { code: "FORBIDDEN_ORIGIN" } }, 403);
  }

  const bodyResult = await readBoundedJsonBody(request, 8 * 1024);
  if (!bodyResult.ok) return bodyResult.response;
  const body = bodyResult.value;
  if (!body || typeof body !== "object" || !("identifier" in body)) {
    return privateJsonResponse({ ok: false, error: { code: "INVALID_IDENTIFIER" } }, 400);
  }

  try {
    const result = await evaluateAccessIdentifier((body as { identifier?: unknown }).identifier);
    return privateJsonResponse({ ok: true, data: result });
  } catch (error) {
    if (error instanceof AccessGateInputError) {
      return privateJsonResponse({ ok: false, error: { code: "INVALID_IDENTIFIER" } }, 400);
    }
    return privateJsonResponse({ ok: false, error: { code: "ACCESS_GATE_UNAVAILABLE" } }, 503);
  }
}
