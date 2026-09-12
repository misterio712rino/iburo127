import { getPracticumState } from "@/lib/platform/demo";

const STORAGE_PREFIX = "iburo.demo.practicum.v1.";
const EVENT_NAME = "iburo-practicum-progress";
const serverSnapshots = new Map<string, string>();

export function getInitialCompletedLessonIds(identityId: string) {
  return [...(getPracticumState(identityId)?.initialCompletedLessonIds ?? [])];
}

export function readCompletedLessonIds(identityId: string) {
  try {
    const value = window.localStorage.getItem(`${STORAGE_PREFIX}${identityId}`);
    return value ? (JSON.parse(value) as string[]) : getInitialCompletedLessonIds(identityId);
  } catch {
    return getInitialCompletedLessonIds(identityId);
  }
}

export function subscribePracticumState(callback: () => void) {
  window.addEventListener(EVENT_NAME, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT_NAME, callback);
    window.removeEventListener("storage", callback);
  };
}

export function getPracticumServerSnapshot(identityId: string) {
  const existing = serverSnapshots.get(identityId);
  if (existing) return existing;

  const value = JSON.stringify(getInitialCompletedLessonIds(identityId));
  serverSnapshots.set(identityId, value);
  return value;
}

export function persistCompletedLessonIds(identityId: string, completedLessonIds: string[]) {
  window.localStorage.setItem(`${STORAGE_PREFIX}${identityId}`, JSON.stringify(completedLessonIds));
  window.dispatchEvent(new Event(EVENT_NAME));
}
