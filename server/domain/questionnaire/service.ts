import type { QuestionnaireAnswer } from "@/lib/platform/types";
import type { AuthenticatedActor } from "@/server/domain/client-cases/contracts";
import { ClientCaseService } from "@/server/domain/client-cases/service";
import type {
  QuestionnaireRecord,
  QuestionnaireRepository,
} from "./contracts";

export const QUESTIONNAIRE_FORBIDDEN = "QUESTIONNAIRE_FORBIDDEN";
export const QUESTIONNAIRE_INVALID_FIELD = "QUESTIONNAIRE_INVALID_FIELD";
export const QUESTIONNAIRE_INVALID_SECTION = "QUESTIONNAIRE_INVALID_SECTION";
export const QUESTIONNAIRE_CASE_NOT_FOUND = "QUESTIONNAIRE_CASE_NOT_FOUND";

export type QuestionnaireDefinition = {
  schemaVersion: number;
  fieldIds: ReadonlySet<string>;
  sectionIds: ReadonlySet<string>;
};

function assertPrimitiveAnswer(value: QuestionnaireAnswer) {
  if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
    throw new Error(QUESTIONNAIRE_INVALID_FIELD);
  }
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
    assertPrimitiveAnswer(input.value);

    if (!this.definition.fieldIds.has(input.fieldId)) {
      throw new Error(QUESTIONNAIRE_INVALID_FIELD);
    }

    return this.repository.saveAnswer(input);
  }

  async completeSection(
    actor: AuthenticatedActor,
    input: { clientCaseId: string; sectionId: string; expectedVersion: number },
  ): Promise<QuestionnaireRecord> {
    await this.requireClientEditor(actor, input.clientCaseId);

    if (!this.definition.sectionIds.has(input.sectionId)) {
      throw new Error(QUESTIONNAIRE_INVALID_SECTION);
    }

    return this.repository.completeSection(input);
  }

  async markCompleted(
    actor: AuthenticatedActor,
    input: { clientCaseId: string; expectedVersion: number },
  ): Promise<QuestionnaireRecord> {
    await this.requireClientEditor(actor, input.clientCaseId);
    return this.repository.markCompleted(input);
  }
}
