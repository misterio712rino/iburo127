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

  for (const section of sections) {
    if (sectionIds.has(section.id)) {
      throw new Error(`QUESTIONNAIRE_DUPLICATE_SECTION:${section.id}`);
    }
    sectionIds.add(section.id);
    sectionsById.set(section.id, section);

    for (const field of section.fields) {
      if (fieldIds.has(field.id)) {
        throw new Error(`QUESTIONNAIRE_DUPLICATE_FIELD:${field.id}`);
      }
      fieldIds.add(field.id);
      fieldsById.set(field.id, field);
    }
  }

  return {
    schemaVersion,
    fieldIds,
    sectionIds,
    fieldsById,
    sectionsById,
    sections,
  };
}
