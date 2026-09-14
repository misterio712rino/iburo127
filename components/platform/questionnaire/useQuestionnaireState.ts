"use client";

import { useSyncExternalStore } from "react";
import { QUESTIONNAIRE_SECTIONS, isQuestionnaireFieldVisible } from "@/lib/platform/demo";
import {
  questionnaireWorkflowService,
  type QuestionnaireStoredState,
} from "@/lib/platform/workflows/questionnaire/questionnaireWorkflowService";
import type { QuestionnaireAnswer } from "@/lib/platform/types";

export function useQuestionnaireState(identityId: string) {
  const serialized = useSyncExternalStore(
    questionnaireWorkflowService.subscribe,
    () => JSON.stringify(questionnaireWorkflowService.read(identityId)),
    () => questionnaireWorkflowService.getServerSnapshot(identityId),
  );
  const state = JSON.parse(serialized) as QuestionnaireStoredState;
  const completed = new Set(state.completedSectionIds);
  const completedCount = completed.size;
  const progress = Math.round((completedCount / QUESTIONNAIRE_SECTIONS.length) * 100);
  const currentSection = QUESTIONNAIRE_SECTIONS.find((section) => !completed.has(section.id)) ?? QUESTIONNAIRE_SECTIONS.at(-1)!;

  function start() {
    questionnaireWorkflowService.start(identityId, state);
  }

  function setAnswer(fieldId: string, value: QuestionnaireAnswer) {
    questionnaireWorkflowService.setAnswer(identityId, state, fieldId, value);
  }

  function validateSection(sectionId: string) {
    const section = QUESTIONNAIRE_SECTIONS.find((item) => item.id === sectionId)!;
    const errors: Record<string, string> = {};

    for (const field of section.fields) {
      if (!field.required || !isQuestionnaireFieldVisible(field, state.answers)) continue;
      const value = state.answers[field.id];
      if (value === "" || value === undefined || value === null) {
        errors[field.id] = field.type === "currency"
          ? `Укажите значение для поля «${field.label}».`
          : `Заполните поле «${field.label}».`;
      }
    }

    return errors;
  }

  function completeSection(sectionId: string) {
    const errors = validateSection(sectionId);
    if (Object.keys(errors).length) return errors;

    const ids = completed.has(sectionId)
      ? state.completedSectionIds
      : [...state.completedSectionIds, sectionId];

    questionnaireWorkflowService.completeSection(identityId, state, ids);

    return errors;
  }

  return {
    ...state,
    completedCount,
    progress,
    currentSection,
    isComplete: completedCount === QUESTIONNAIRE_SECTIONS.length,
    start,
    setAnswer,
    completeSection,
    validateSection,
    isCompleted: (id: string) => completed.has(id),
  };
}
