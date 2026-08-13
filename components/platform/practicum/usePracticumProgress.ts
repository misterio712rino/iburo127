"use client";

import { useSyncExternalStore } from "react";
import { getPracticumState, PRACTICUM_LESSONS } from "@/lib/platform/demo";
import type { LessonStatus } from "@/lib/platform/types";

const STORAGE_PREFIX = "iburo.demo.practicum.v1.";
const EVENT_NAME = "iburo-practicum-progress";

function subscribe(callback: () => void) { window.addEventListener(EVENT_NAME, callback); window.addEventListener("storage", callback); return () => { window.removeEventListener(EVENT_NAME, callback); window.removeEventListener("storage", callback); }; }
function initialIds(identityId: string) { return [...(getPracticumState(identityId)?.initialCompletedLessonIds ?? [])]; }
function readIds(identityId: string) { try { const value = window.localStorage.getItem(`${STORAGE_PREFIX}${identityId}`); return value ? JSON.parse(value) as string[] : initialIds(identityId); } catch { return initialIds(identityId); } }
const serverSnapshots = new Map<string, string>();
function serverSnapshot(identityId:string) { const existing=serverSnapshots.get(identityId); if(existing) return existing; const next=JSON.stringify(initialIds(identityId)); serverSnapshots.set(identityId,next); return next; }

export function usePracticumProgress(identityId: string) {
  const serialized = useSyncExternalStore(subscribe, () => JSON.stringify(readIds(identityId)), () => serverSnapshot(identityId));
  const completedLessonIds = JSON.parse(serialized) as string[];
  const completed = new Set(completedLessonIds);
  const completedCount = completed.size;
  const progress = Math.round((completedCount / PRACTICUM_LESSONS.length) * 100);
  const currentLesson = PRACTICUM_LESSONS.find((lesson) => !completed.has(lesson.id));

  function completeLesson(lessonId: string) {
    if (completed.has(lessonId)) return;
    const next = [...completedLessonIds, lessonId];
    window.localStorage.setItem(`${STORAGE_PREFIX}${identityId}`, JSON.stringify(next));
    window.dispatchEvent(new Event(EVENT_NAME));
  }

  function getStatus(lessonId: string): LessonStatus {
    if (completed.has(lessonId)) return "completed";
    if (currentLesson?.id === lessonId) return "current";
    const lesson = PRACTICUM_LESSONS.find((item) => item.id === lessonId)!;
    const currentNumber = currentLesson?.number ?? PRACTICUM_LESSONS.length;
    return lesson.number === currentNumber + 1 ? "available" : "locked";
  }

  return { completedLessonIds, completedCount, progress, currentLesson, completeLesson, getStatus, isComplete: completedCount === PRACTICUM_LESSONS.length };
}
