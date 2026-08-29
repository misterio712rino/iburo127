import "server-only";

import type { SessionProvider } from "@/server/auth/contracts";
import {
  handleCompleteQuestionnaire,
  handleCompleteQuestionnaireSection,
  handleGetOrCreateQuestionnaire,
  handleGetQuestionnaire,
  handleSaveQuestionnaireAnswer,
} from "@/server/questionnaire/handlers";
import { toQuestionnaireHttpResponse } from "@/server/questionnaire/http";
import { readBoundedJsonBody } from "@/server/http/bounded-json-body";

function withAuthoritativeClientCaseId(body: unknown, clientCaseId: unknown): unknown {
  if (!body || typeof body !== "object" || Array.isArray(body)) return body;
  return {
    ...(body as Record<string, unknown>),
    clientCaseId,
  };
}

export function createQuestionnaireRouteAdapter(sessionProvider: SessionProvider) {
  return {
    async get(clientCaseId: unknown): Promise<Response> {
      return toQuestionnaireHttpResponse(
        await handleGetQuestionnaire(sessionProvider, clientCaseId),
      );
    },

    async getOrCreate(clientCaseId: unknown): Promise<Response> {
      return toQuestionnaireHttpResponse(
        await handleGetOrCreateQuestionnaire(sessionProvider, clientCaseId),
      );
    },

    async saveAnswer(clientCaseId: unknown, request: Request): Promise<Response> {
      const bodyResult = await readBoundedJsonBody(request);
      if (!bodyResult.ok) return bodyResult.response;
      const body = withAuthoritativeClientCaseId(bodyResult.value, clientCaseId);
      return toQuestionnaireHttpResponse(
        await handleSaveQuestionnaireAnswer(sessionProvider, body),
      );
    },

    async completeSection(clientCaseId: unknown, request: Request): Promise<Response> {
      const bodyResult = await readBoundedJsonBody(request);
      if (!bodyResult.ok) return bodyResult.response;
      const body = withAuthoritativeClientCaseId(bodyResult.value, clientCaseId);
      return toQuestionnaireHttpResponse(
        await handleCompleteQuestionnaireSection(sessionProvider, body),
      );
    },

    async complete(clientCaseId: unknown, request: Request): Promise<Response> {
      const bodyResult = await readBoundedJsonBody(request);
      if (!bodyResult.ok) return bodyResult.response;
      const body = withAuthoritativeClientCaseId(bodyResult.value, clientCaseId);
      return toQuestionnaireHttpResponse(
        await handleCompleteQuestionnaire(sessionProvider, body),
      );
    },
  };
}
