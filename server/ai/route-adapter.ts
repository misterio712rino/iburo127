import "server-only";

import type { SessionProvider } from "@/server/auth/contracts";
import { requireServerActor, UNAUTHENTICATED } from "@/server/auth/runtime";
import { AI_PROVIDER_ERROR } from "@/server/ai/openai-responses-core";
import { getAiAssistantService } from "@/server/ai/runtime";
import {
  AI_ACCESS_DENIED,
  AI_CASE_NOT_FOUND,
  AI_FEATURE_NOT_AVAILABLE,
  AI_INVALID_REQUEST,
  AI_MODEL_RESPONSE_INVALID,
} from "@/server/domain/ai/contracts";
import { PRODUCTION_CONFIG_ERROR } from "@/server/config/production";
import { privateJsonResponse } from "@/server/http/private-json";

async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

function errorCode(error: unknown): string {
  return error instanceof Error ? error.message : "";
}

export function createAiRouteAdapter(sessionProvider: SessionProvider) {
  return {
    async reply(clientCaseId: unknown, request: Request): Promise<Response> {
      if (typeof clientCaseId !== "string" || !clientCaseId.trim()) {
        return privateJsonResponse({ ok: false, error: { code: "NOT_FOUND" } }, 404);
      }

      try {
        const actor = await requireServerActor(sessionProvider);
        const result = await getAiAssistantService().reply(
          actor,
          clientCaseId.trim(),
          await readJsonBody(request),
        );
        return privateJsonResponse({ ok: true, data: result });
      } catch (error) {
        const code = errorCode(error);
        if (code === UNAUTHENTICATED) {
          return privateJsonResponse({ ok: false, error: { code: "UNAUTHENTICATED" } }, 401);
        }
        if (code === AI_ACCESS_DENIED) {
          return privateJsonResponse({ ok: false, error: { code: "FORBIDDEN" } }, 403);
        }
        if (code === AI_CASE_NOT_FOUND) {
          return privateJsonResponse({ ok: false, error: { code: "NOT_FOUND" } }, 404);
        }
        if (code === AI_FEATURE_NOT_AVAILABLE) {
          return privateJsonResponse(
            { ok: false, error: { code: "AI_FEATURE_NOT_AVAILABLE" } },
            403,
          );
        }
        if (code === AI_INVALID_REQUEST) {
          return privateJsonResponse({ ok: false, error: { code: "INVALID_REQUEST" } }, 400);
        }
        if (
          code === AI_MODEL_RESPONSE_INVALID ||
          code.startsWith(`${AI_PROVIDER_ERROR}:`) ||
          code.startsWith(`${PRODUCTION_CONFIG_ERROR}:`)
        ) {
          return privateJsonResponse(
            { ok: false, error: { code: "AI_TEMPORARILY_UNAVAILABLE" } },
            503,
          );
        }
        return privateJsonResponse({ ok: false, error: { code: "INTERNAL_ERROR" } }, 500);
      }
    },
  };
}
