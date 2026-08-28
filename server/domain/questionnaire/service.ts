import type {
  QuestionnaireAnswer,
  QuestionnaireAnswers,
  QuestionnaireField,
  QuestionnaireSection,
} from "@/lib/platform/types";
import { isQuestionnaireFieldVisible } from "@/lib/platform/questionnaire-content";
import type { AuthenticatedActor } from "@/server/domain/client-cases/contracts";
import { ClientCaseService } from "@/server/domain/client-cases/service";
import {
  QUESTIONNAIRE_NOT_FOUND,
  type QuestionnaireRecord,
  type QuestionnaireRepository,
} from "./contracts";

export const QUESTIONNAIRE_FORBIDDEN = "QUESTIONNAIRE_FORBIDDEN";
export const QUESTIONNAIRE_INVALID_FIELD = "QUESTIONNAIRE_INVALID_FIELD";
export const QUESTIONNAIRE_INVALID_SECTION = "QUESTIONNAIRE_INVALID_SECTION";
export const QUESTIONNAIRE_CASE_NOT_FOUND = "QUESTIONNAIRE_CASE_NOT_FOUND";
export const QUESTIONNAIRE_ALREADY_COMPLETED = "QUESTIONNAIRE_ALREADY_COMPLETED";
export const QUESTIONNAIRE_INCOMPLETE_SECTION = "QUESTIONNAIRE_INCOMPLETE_SECTION";
export const QUESTIONNAIRE_INCOMPLETE = "QUESTIONNAIRE_INCOMPLETE";

export type QuestionnaireDefinition = {
  schemaVersion: number;
  fieldIds: ReadonlySet<string>;
  sectionIds: ReadonlySet<string>;
  fieldsById: ReadonlyMap<string, QuestionnaireField>;
  sectionsById: ReadonlyMap<string, QuestionnaireSection>;
  sections: readonly QuestionnaireSection[];
};

function hasAnswer(answers: QuestionnaireAnswers, fieldId: string) {
  const value = answers[fieldId];
  return value !== undefined && value !== "";
}

function assertFieldAnswer(field: QuestionnaireField, value: QuestionnaireAnswer) {
  if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
    throw new Error(QUESTIONNAIRE_INVALID_FIELD);
  }

  switch (field.type) {
    case "number":
    case "currency":
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
        throw new Error(QUESTIONNAIRE_INVALID_FIELD);
      }
      return;
    case "yes-no":
      if (typeof value !== "boolean") throw new Error(QUESTIONNAIRE_INVALID_FIELD);
      return;
    case "select":
    case "radio":
      if (typeof value !== "string" || !field.options?.includes(value)) {
        throw new Error(QUESTIONNAIRE_INVALID_FIELD);
      }
      return;
    case "date":
      if (
        typeof value !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
        Number.isNaN(Date.parse(`${value}T00:00:00Z`))
      ) {
        throw new Error(QUESTIONNAIRE_INVALID_FIELD);
      }
      return;
    case "text":
    case "textarea":
      if (
        typeof value !== "string" ||
        value.trim().length === 0 ||
        value.length > 5000 ||
        value.includes("\0")
      ) {
        throw new Error(QUESTIONNAIRE_INVALID_FIELD);
      }
      return;
    default:
      throw new Error(QUESTIONNAIRE_INVALID_FIELD);
  }
}

function assertSectionComplete(section: QuestionnaireSection, answers: QuestionnaireAnswers) {
  for (const field of section.fields) {
    if (!field.required || !isQuestionnaireFieldVisible(field, answers)) continue;
    if (!hasAnswer(answers, field.id)) throw new Error(QUESTIONNAIRE_INCOMPLETE_SECTION);
    assertFieldAnswer(field, answers[field.id]);
  }
}

function assertMutable(record: QuestionnaireRecord) {
  if (record.status === "COMPLETED") throw new Error(QUESTIONNAIRE_ALREADY_COMPLETED);
}

export class QuestionnaireService {
  constructor(
    private readonly cases: ClientCaseService,
    private readonly repository: QuestionnaireRepository,
    private readonly definition: QuestionnaireDefinition,
  ) {}

  private async requireAccessibleCase(actor: AuthenticatedActor, clientCaseId: string) {
    const clientCase = await this.cases.getCase(actor, { caseId: clientCaseId });
    if (!clientCase) throw new Error(QUESTIONNAIRE_CASE_NOT_FOUND);
    return clientCase;
  }

  private async requireClientEditor(actor: AuthenticatedActor, clientCaseId: string) {
    const clientCase = await this.requireAccessibleCase(actor, clientCaseId);
    const canEdit = actor.roles.includes("CLIENT") && clientCase.clientId === actor.userId;
    if (!canEdit) throw new Error(QUESTIONNAIRE_FORBIDDEN);
    return clientCase;
  }

  private async requireQuestionnaire(clientCaseId: string) {
    const record = await this.repository.getByClientCaseId(clientCaseId);
    if (!record) throw new Error(QUESTIONNAIRE_NOT_FOUND);
    return record;
  }

  async get(actor: AuthenticatedActor, clientCaseId: string): Promise<QuestionnaireRecord | null> {
    await this.requireAccessibleCase(actor, clientCaseId);
    return this.repository.getByClientCaseId(clientCaseId);
  }

  async getOrCreateForClient(actor: AuthenticatedActor, clientCaseId: string): Promise<QuestionnaireRecord> {
    await this.requireClientEditor(actor, clientCaseId);

    const existing = await this.repository.getByClientCaseId(clientCaseId);
    if (existing) return existing;

    return this.repository.createForCase(clientCaseId, this.definition.schemaVersion);
  }

  async saveAnswer(
    actor: AuthenticatedActor,
    input: { clientCaseId: string; fieldId: string; value: QuestionnaireAnswer; expectedVersion: number },
  ): Promise<QuestionnaireRecord> {
    await this.requireClientEditor(actor, input.clientCaseId);
    const current = await this.requireQuestionnaire(input.clientCaseId);
    assertMutable(current);

    const field = this.definition.fieldsById.get(input.fieldId);
    if (!field) throw new Error(QUESTIONNAIRE_INVALID_FIELD);
    assertFieldAnswer(field, input.value);

    return this.repository.saveAnswer(input);
  }

  async completeSection(
    actor: AuthenticatedActor,
    input: { clientCaseId: string; sectionId: string; expectedVersion: number },
  ): Promise<QuestionnaireRecord> {
    await this.requireClientEditor(actor, input.clientCaseId);
    const current = await this.requireQuestionnaire(input.clientCaseId);
    assertMutable(current);

    const section = this.definition.sectionsById.get(input.sectionId);
    if (!section) throw new Error(QUESTIONNAIRE_INVALID_SECTION);

    if (section.review) {
      const missingPrevious = this.definition.sections
        .filter((item) => !item.review)
        .some((item) => !current.completedSectionIds.includes(item.id));
      if (missingPrevious) throw new Error(QUESTIONNAIRE_INCOMPLETE_SECTION);
    }

    assertSectionComplete(section, current.answers);
    return this.repository.completeSection(input);
  }

  async markCompleted(
    actor: AuthenticatedActor,
    input: { clientCaseId: string; expectedVersion: number },
  ): Promise<QuestionnaireRecord> {
    await this.requireClientEditor(actor, input.clientCaseId);
    const current = await this.requireQuestionnaire(input.clientCaseId);
    assertMutable(current);

    for (const section of this.definition.sections) {
      if (!current.completedSectionIds.includes(section.id)) {
        throw new Error(QUESTIONNAIRE_INCOMPLETE);
      }
      assertSectionComplete(section, current.answers);
    }

    return this.repository.markCompleted(input);
  }
}
