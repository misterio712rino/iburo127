import "server-only";

import type { SessionProvider } from "@/server/auth/contracts";
import {
  completePracticumLesson,
  getOrCreatePracticumProgressForClient,
  getPracticumProgress,
} from "@/server/practicum/operations";
import {
  parseCompletePracticumLessonInput,
  parsePracticumClientCaseId,
} from "@/server/practicum/input";
import { executePracticumOperation } from "@/server/practicum/transport";

export function handleGetPracticumProgress(
  sessionProvider: SessionProvider,
  clientCaseId: unknown,
) {
  return executePracticumOperation(() =>
    getPracticumProgress(sessionProvider, parsePracticumClientCaseId(clientCaseId)),
  );
}

export function handleGetOrCreatePracticumProgress(
  sessionProvider: SessionProvider,
  clientCaseId: unknown,
) {
  return executePracticumOperation(() =>
    getOrCreatePracticumProgressForClient(
      sessionProvider,
      parsePracticumClientCaseId(clientCaseId),
    ),
  );
}

export function handleCompletePracticumLesson(
  sessionProvider: SessionProvider,
  input: unknown,
) {
  return executePracticumOperation(() =>
    completePracticumLesson(sessionProvider, parseCompletePracticumLessonInput(input)),
  );
}
