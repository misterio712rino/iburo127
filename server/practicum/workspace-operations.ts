import "server-only";

import type { SessionProvider } from "@/server/auth/contracts";
import { requireServerActor } from "@/server/auth/runtime";
import type { PracticumHomeworkReviewDecision } from "@/server/domain/practicum/workspace-contracts";
import { practicumWorkspaceService } from "@/server/practicum/workspace-runtime";

export async function getPracticumLessonWorkspace(
  sessionProvider: SessionProvider,
  input: { clientCaseId: string; lessonId: string },
) {
  const actor = await requireServerActor(sessionProvider);
  return practicumWorkspaceService.getLessonWorkspace(actor, input);
}

export async function savePracticumHomeworkDraft(
  sessionProvider: SessionProvider,
  input: { clientCaseId: string; lessonId: string; answerText: unknown },
) {
  const actor = await requireServerActor(sessionProvider);
  return practicumWorkspaceService.saveHomeworkDraft(actor, input);
}

export async function submitPracticumHomework(
  sessionProvider: SessionProvider,
  input: { clientCaseId: string; lessonId: string; answerText: unknown },
) {
  const actor = await requireServerActor(sessionProvider);
  return practicumWorkspaceService.submitHomework(actor, input);
}

export async function reviewPracticumHomework(
  sessionProvider: SessionProvider,
  input: {
    clientCaseId: string;
    lessonId: string;
    decision: PracticumHomeworkReviewDecision;
    comment: unknown;
  },
) {
  const actor = await requireServerActor(sessionProvider);
  return practicumWorkspaceService.reviewHomework(actor, input);
}

export async function sendPracticumLessonMessage(
  sessionProvider: SessionProvider,
  input: { clientCaseId: string; lessonId: string; body: unknown },
) {
  const actor = await requireServerActor(sessionProvider);
  return practicumWorkspaceService.sendLessonMessage(actor, input);
}
