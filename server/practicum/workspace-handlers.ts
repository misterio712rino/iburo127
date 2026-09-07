import "server-only";

import type { SessionProvider } from "@/server/auth/contracts";
import {
  getPracticumLessonWorkspace,
  reviewPracticumHomework,
  savePracticumHomeworkDraft,
  sendPracticumLessonMessage,
  submitPracticumHomework,
} from "@/server/practicum/workspace-operations";
import {
  parsePracticumHomeworkMutation,
  parsePracticumHomeworkReview,
  parsePracticumLessonMessage,
  parsePracticumWorkspaceIdentity,
} from "@/server/practicum/workspace-input";
import { executePracticumOperation } from "@/server/practicum/transport";

export function handleGetPracticumLessonWorkspace(
  sessionProvider: SessionProvider,
  identity: { clientCaseId: unknown; lessonId: unknown },
) {
  return executePracticumOperation(() =>
    getPracticumLessonWorkspace(
      sessionProvider,
      parsePracticumWorkspaceIdentity(identity),
    ),
  );
}

export function handlePracticumHomeworkMutation(
  sessionProvider: SessionProvider,
  identity: { clientCaseId: unknown; lessonId: unknown },
  body: unknown,
) {
  return executePracticumOperation(async () => {
    const input = parsePracticumHomeworkMutation(body, identity);
    if (input.action === "save_draft") {
      return savePracticumHomeworkDraft(sessionProvider, input);
    }
    return submitPracticumHomework(sessionProvider, input);
  });
}

export function handlePracticumHomeworkReview(
  sessionProvider: SessionProvider,
  identity: { clientCaseId: unknown; lessonId: unknown },
  body: unknown,
) {
  return executePracticumOperation(() =>
    reviewPracticumHomework(
      sessionProvider,
      parsePracticumHomeworkReview(body, identity),
    ),
  );
}

export function handlePracticumLessonMessage(
  sessionProvider: SessionProvider,
  identity: { clientCaseId: unknown; lessonId: unknown },
  body: unknown,
) {
  return executePracticumOperation(() =>
    sendPracticumLessonMessage(
      sessionProvider,
      parsePracticumLessonMessage(body, identity),
    ),
  );
}
