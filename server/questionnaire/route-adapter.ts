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

async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

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
      const body = withAuthoritativeClientCaseId(await readJsonBody(request), clientCaseId);
      return toQuestionnaireHttpResponse(
        await handleSaveQuestionnaireAnswer(sessionProvider, body),
      );
    },

    async completeSection(clientCaseId: unknown, request: Request): Promise<Response> {
      const body = withAuthoritativeClientCaseId(await readJsonBody(request), clientCaseId);
      return toQuestionnaireHttpResponse(
        await handleCompleteQuestionnaireSection(sessionProvider, body),
      );
    },

    async complete(clientCaseId: unknown, request: Request): Promise<Response> {
      const body = withAuthoritativeClientCaseId(await readJsonBody(request), clientCaseId);
      return toQuestionnaireHttpResponse(
        await handleCompleteQuestionnaire(sessionProvider, body),
      );
    },
  };
}
