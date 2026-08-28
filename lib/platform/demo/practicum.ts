import type { ClientPracticumState } from "../types";
import {
  PRACTICUM_LESSONS,
  PRACTICUM_MODULES,
  getLessonModule,
  getPracticumLesson,
} from "../practicum-content";

export {
  PRACTICUM_LESSONS,
  PRACTICUM_MODULES,
  getLessonModule,
  getPracticumLesson,
} from "../practicum-content";

const ALL_LESSON_IDS = PRACTICUM_LESSONS.map((lesson) => lesson.id);

export const CLIENT_PRACTICUM_STATES = [
  { identityId:"alexander-lite", initialCompletedLessonIds:["lesson-1","lesson-2","lesson-3"] },
  { identityId:"maria-pro", initialCompletedLessonIds:ALL_LESSON_IDS },
  { identityId:"dmitry-individual", initialCompletedLessonIds:ALL_LESSON_IDS },
] as const satisfies readonly ClientPracticumState[];

export function getPracticumState(identityId:string): ClientPracticumState | undefined {
  return CLIENT_PRACTICUM_STATES.find((state)=>state.identityId===identityId);
}

export function getPracticumProgress(identityId:string) {
  const state=getPracticumState(identityId);
  return state ? Math.round(new Set(state.initialCompletedLessonIds).size/PRACTICUM_LESSONS.length*100) : undefined;
}
