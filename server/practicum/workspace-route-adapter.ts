import "server-only";

import type { SessionProvider } from "@/server/auth/contracts";
import { readBoundedJsonBody } from "@/server/http/bounded-json-body";
import { toPracticumHttpResponse } from "@/server/practicum/http";
import {
  handleGetPracticumLessonWorkspace,
  handlePracticumHomeworkMutation,
  handlePracticumHomeworkReview,
  handlePracticumLessonMessage,
} from "@/server/practicum/workspace-handlers";

type Identity = { clientCaseId: unknown; lessonId: unknown };

async function readBody(request: Request) {
  const bodyResult = await readBoundedJsonBody(request);
  if (!bodyResult.ok) return bodyResult;
  return bodyResult;
}

export function createPracticumWorkspaceRouteAdapter(sessionProvider: SessionProvider) {
  return {
    async get(identity: Identity): Promise<Response> {
      return toPracticumHttpResponse(
        await handleGetPracticumLessonWorkspace(sessionProvider, identity),
      );
    },

    async mutateHomework(identity: Identity, request: Request): Promise<Response> {
      const bodyResult = await readBody(request);
      if (!bodyResult.ok) return bodyResult.response;
      return toPracticumHttpResponse(
        await handlePracticumHomeworkMutation(sessionProvider, identity, bodyResult.value),
      );
    },

    async reviewHomework(identity: Identity, request: Request): Promise<Response> {
      const bodyResult = await readBody(request);
      if (!bodyResult.ok) return bodyResult.response;
      return toPracticumHttpResponse(
        await handlePracticumHomeworkReview(sessionProvider, identity, bodyResult.value),
      );
    },

    async sendMessage(identity: Identity, request: Request): Promise<Response> {
      const bodyResult = await readBody(request);
      if (!bodyResult.ok) return bodyResult.response;
      return toPracticumHttpResponse(
        await handlePracticumLessonMessage(sessionProvider, identity, bodyResult.value),
      );
    },
  };
}
