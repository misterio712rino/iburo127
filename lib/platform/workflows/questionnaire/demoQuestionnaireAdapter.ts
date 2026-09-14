import { getQuestionnaireSeed } from "@/lib/platform/demo";
import type { QuestionnaireAnswers } from "@/lib/platform/types";

export type QuestionnaireStoredState = {
  started: boolean;
  answers: QuestionnaireAnswers;
  completedSectionIds: string[];
};

const STORAGE_PREFIX = "iburo.demo.questionnaire.v1.";
const EVENT_NAME = "iburo-questionnaire-progress";
const serverSnapshots = new Map<string, string>();

export function getInitialQuestionnaireState(identityId: string): QuestionnaireStoredState {
  const seed = getQuestionnaireSeed(identityId);
  return {
    started: seed?.started ?? false,
    answers: { ...(seed?.initialAnswers ?? {}) },
    completedSectionIds: [...(seed?.initialCompletedSectionIds ?? [])],
  };
}

export function readQuestionnaireState(identityId: string): QuestionnaireStoredState {
  try {
    const stored = window.localStorage.getItem(`${STORAGE_PREFIX}${identityId}`);
    return stored ? (JSON.parse(stored) as QuestionnaireStoredState) : getInitialQuestionnaireState(identityId);
  } catch {
    return getInitialQuestionnaireState(identityId);
  }
}

export function subscribeQuestionnaireState(callback: () => void) {
  window.addEventListener(EVENT_NAME, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT_NAME, callback);
    window.removeEventListener("storage", callback);
  };
}

export function getQuestionnaireServerSnapshot(identityId: string) {
  const existing = serverSnapshots.get(identityId);
  if (existing) return existing;

  const value = JSON.stringify(getInitialQuestionnaireState(identityId));
  serverSnapshots.set(identityId, value);
  return value;
}

export function persistQuestionnaireState(identityId: string, state: QuestionnaireStoredState) {
  window.localStorage.setItem(`${STORAGE_PREFIX}${identityId}`, JSON.stringify(state));
  window.dispatchEvent(new Event(EVENT_NAME));
}
