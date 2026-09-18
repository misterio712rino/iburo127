export const PRACTICUM_COMPLETION_INVALID_DEFINITION = "PRACTICUM_COMPLETION_INVALID_DEFINITION";

export function computePracticumCompletion(input: {
  completedLessonIds: readonly string[];
  lessonId: string;
  requiredLessonIds: readonly string[];
  completedAt: Date | null;
  now: Date;
}) {
  const required = new Set(input.requiredLessonIds);
  if (
    required.size === 0 ||
    required.size !== input.requiredLessonIds.length ||
    !required.has(input.lessonId) ||
    !(input.now instanceof Date) ||
    !Number.isFinite(input.now.getTime())
  ) {
    throw new Error(PRACTICUM_COMPLETION_INVALID_DEFINITION);
  }

  const previous = new Set(input.completedLessonIds);
  const lessonJustCompleted = !previous.has(input.lessonId);
  const completedLessonIds = lessonJustCompleted
    ? [...input.completedLessonIds, input.lessonId]
    : [...input.completedLessonIds];
  const next = new Set(completedLessonIds);
  const wasProgramComplete = input.requiredLessonIds.every((id) => previous.has(id));
  const isProgramComplete = input.requiredLessonIds.every((id) => next.has(id));
  const programJustCompleted = !wasProgramComplete && isProgramComplete;

  // Correct legacy records that prematurely set completedAt when the final
  // numbered lesson was marked before the rest of the course.
  const completedAt = !isProgramComplete
    ? null
    : programJustCompleted
      ? input.now
      : input.completedAt ?? input.now;

  return {
    completedLessonIds,
    lessonJustCompleted,
    programJustCompleted,
    completedAt,
  };
}
