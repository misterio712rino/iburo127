import "server-only";

import type { SessionProvider } from "@/server/auth/contracts";
import { readBoundedJsonBody } from "@/server/http/bounded-json-body";
import {
  handleCompletePracticumLesson,
  handleGetOrCreatePracticumProgress,
  handleGetPracticumProgress,
} from "@/server/practicum/handlers";
import { toPracticumHttpResponse } from "@/server/practicum/http";

function withAuthoritativeClientCaseId(body: unknown, clientCaseId: unknown): unknown {
  if (!body || typeof body !== "object" || Array.isArray(body)) return body;
  return {
    ...(body as Record<string, unknown>),
    clientCaseId,
  };
}

export function createPracticumRouteAdapter(sessionProvider: SessionProvider) {
  return {
    async get(clientCaseId: unknown): Promise<Response> {
      return toPracticumHttpResponse(
        await handleGetPracticumProgress(sessionProvider, clientCaseId),
      );
    },

    async getOrCreate(clientCaseId: unknown): Promise<Response> {
      return toPracticumHttpResponse(
        await handleGetOrCreatePracticumProgress(sessionProvider, clientCaseId),
      );
    },

    async completeLesson(clientCaseId: unknown, request: Request): Promise<Response> {
      const bodyResult = await readBoundedJsonBody(request);
      if (!bodyResult.ok) return bodyResult.response;
      const body = withAuthoritativeClientCaseId(bodyResult.value, clientCaseId);
      return toPracticumHttpResponse(
        await handleCompletePracticumLesson(sessionProvider, body),
      );
    },
  };
}
