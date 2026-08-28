import type { QuestionnaireField, QuestionnaireSection } from "@/lib/platform/types";
import type { QuestionnaireDefinition } from "./service";

export function createQuestionnaireDefinition(
  sections: readonly QuestionnaireSection[],
  schemaVersion: number,
): QuestionnaireDefinition {
  if (!Number.isInteger(schemaVersion) || schemaVersion < 1) {
    throw new Error("QUESTIONNAIRE_INVALID_SCHEMA_VERSION");
  }

  const sectionIds = new Set<string>();
  const fieldIds = new Set<string>();
  const sectionsById = new Map<string, QuestionnaireSection>();
  const fieldsById = new Map<string, QuestionnaireField>();
  const fieldSectionIds = new Map<string, string>();
  const reviewSectionIds: string[] = [];

  for (const section of sections) {
    if (sectionIds.has(section.id)) {
      throw new Error(`QUESTIONNAIRE_DUPLICATE_SECTION:${section.id}`);
    }
    sectionIds.add(section.id);
    sectionsById.set(section.id, section);
    if (section.review) reviewSectionIds.push(section.id);

    for (const field of section.fields) {
      if (fieldIds.has(field.id)) {
        throw new Error(`QUESTIONNAIRE_DUPLICATE_FIELD:${field.id}`);
      }
      fieldIds.add(field.id);
      fieldsById.set(field.id, field);
      fieldSectionIds.set(field.id, section.id);
    }
  }

  return {
    schemaVersion,
    fieldIds,
    sectionIds,
    fieldsById,
    sectionsById,
    fieldSectionIds,
    reviewSectionIds,
    sections,
  };
}
