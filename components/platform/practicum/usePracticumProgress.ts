"use client";

import { useSyncExternalStore } from "react";
import { PRACTICUM_LESSONS } from "@/lib/platform/demo";
import {
  getPracticumServerSnapshot,
  persistCompletedLessonIds,
  readCompletedLessonIds,
  subscribePracticumState,
} from "@/lib/platform/workflows/practicum/demoPracticumAdapter";
import type { LessonStatus } from "@/lib/platform/types";

export function usePracticumProgress(identityId: string) {
  const serialized = useSyncExternalStore(
    subscribePracticumState,
    () => JSON.stringify(readCompletedLessonIds(identityId)),
    () => getPracticumServerSnapshot(identityId),
  );
  const completedLessonIds = JSON.parse(serialized) as string[];
  const completed = new Set(completedLessonIds);
  const completedCount = completed.size;
  const progress = Math.round((completedCount / PRACTICUM_LESSONS.length) * 100);
  const currentLesson = PRACTICUM_LESSONS.find((lesson) => !completed.has(lesson.id));

  function completeLesson(lessonId: string) {
    if (completed.has(lessonId)) return;
    persistCompletedLessonIds(identityId, [...completedLessonIds, lessonId]);
  }

  function getStatus(lessonId: string): LessonStatus {
    if (completed.has(lessonId)) return "completed";
    if (currentLesson?.id === lessonId) return "current";

    const lesson = PRACTICUM_LESSONS.find((item) => item.id === lessonId)!;
    const currentNumber = currentLesson?.number ?? PRACTICUM_LESSONS.length;
    return lesson.number === currentNumber + 1 ? "available" : "locked";
  }

  return {
    completedLessonIds,
    completedCount,
    progress,
    currentLesson,
    completeLesson,
    getStatus,
    isComplete: completedCount === PRACTICUM_LESSONS.length,
  };
}
