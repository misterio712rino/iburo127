import "server-only";

import type { SessionProvider } from "@/server/auth/contracts";
import { requireServerActor } from "@/server/auth/runtime";
import { practicumService } from "@/server/practicum/runtime";

export async function getPracticumProgress(
  sessionProvider: SessionProvider,
  clientCaseId: string,
) {
  const actor = await requireServerActor(sessionProvider);
  return practicumService.get(actor, clientCaseId);
}

export async function getOrCreatePracticumProgressForClient(
  sessionProvider: SessionProvider,
  clientCaseId: string,
) {
  const actor = await requireServerActor(sessionProvider);
  return practicumService.getOrCreateForClient(actor, clientCaseId);
}

export async function completePracticumLesson(
  sessionProvider: SessionProvider,
  input: { clientCaseId: string; lessonId: string; expectedVersion?: number },
) {
  const actor = await requireServerActor(sessionProvider);
  return practicumService.completeLesson(actor, input);
}
