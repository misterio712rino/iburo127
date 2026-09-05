import "server-only";

import type { SessionProvider } from "@/server/auth/contracts";
import { requireServerActor, UNAUTHENTICATED } from "@/server/auth/runtime";
import { AI_PROVIDER_ERROR } from "@/server/ai/openai-responses-core";
import { AI_PROVIDER_CONFIG_ERROR } from "@/server/ai/provider-config-core";
import { getAiAssistantService } from "@/server/ai/runtime";
import { AI_USAGE_CONFIG_ERROR } from "@/server/ai/usage-config";
import {
  AI_ACCESS_DENIED,
  AI_AUDIT_FAILED,
  AI_CASE_NOT_FOUND,
  AI_FEATURE_NOT_AVAILABLE,
  AI_INVALID_REQUEST,
  AI_MODEL_RESPONSE_INVALID,
  AI_RATE_LIMITED,
} from "@/server/domain/ai/contracts";
import { PRODUCTION_CONFIG_ERROR } from "@/server/config/production";
import { readBoundedJsonBody } from "@/server/http/bounded-json-body";
import { privateJsonResponse } from "@/server/http/private-json";

function errorCode(error: unknown): string {
  return error instanceof Error ? error.message : "";
}

function toAiErrorResponse(error: unknown): Response {
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
  if (code === AI_RATE_LIMITED) {
    return privateJsonResponse({ ok: false, error: { code: "AI_RATE_LIMITED" } }, 429);
  }
  if (code === AI_INVALID_REQUEST) {
    return privateJsonResponse({ ok: false, error: { code: "INVALID_REQUEST" } }, 400);
  }
  if (
    code === AI_AUDIT_FAILED ||
    code === AI_MODEL_RESPONSE_INVALID ||
    code.startsWith(`${AI_PROVIDER_ERROR}:`) ||
    code.startsWith(`${AI_PROVIDER_CONFIG_ERROR}:`) ||
    code.startsWith(`${AI_USAGE_CONFIG_ERROR}:`) ||
    code.startsWith(`${PRODUCTION_CONFIG_ERROR}:`)
  ) {
    return privateJsonResponse(
      { ok: false, error: { code: "AI_TEMPORARILY_UNAVAILABLE" } },
      503,
    );
  }
  return privateJsonResponse({ ok: false, error: { code: "INTERNAL_ERROR" } }, 500);
}

function normalizeCaseId(clientCaseId: unknown): string | null {
  return typeof clientCaseId === "string" && clientCaseId.trim()
    ? clientCaseId.trim()
    : null;
}

export function createAiRouteAdapter(sessionProvider: SessionProvider) {
  return {
    async describe(clientCaseId: unknown): Promise<Response> {
      const caseId = normalizeCaseId(clientCaseId);
      if (!caseId) {
        return privateJsonResponse({ ok: false, error: { code: "NOT_FOUND" } }, 404);
      }

      try {
        const actor = await requireServerActor(sessionProvider);
        const result = await getAiAssistantService().describe(actor, caseId);
        return privateJsonResponse({ ok: true, data: result });
      } catch (error) {
        return toAiErrorResponse(error);
      }
    },

    async reply(clientCaseId: unknown, request: Request): Promise<Response> {
      const caseId = normalizeCaseId(clientCaseId);
      if (!caseId) {
        return privateJsonResponse({ ok: false, error: { code: "NOT_FOUND" } }, 404);
      }

      try {
        const actor = await requireServerActor(sessionProvider);
        const bodyResult = await readBoundedJsonBody(request);
        if (!bodyResult.ok) return bodyResult.response;
        const result = await getAiAssistantService().reply(
          actor,
          caseId,
          bodyResult.value,
        );
        return privateJsonResponse({ ok: true, data: result });
      } catch (error) {
        return toAiErrorResponse(error);
      }
    },
  };
}
