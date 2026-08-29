import type { AuthenticatedActor } from "@/server/domain/client-cases/contracts";
import { ClientCaseService } from "@/server/domain/client-cases/service";
import {
  DOCUMENT_NOT_FOUND,
  type CaseDocumentRecord,
  type CaseDocumentRepository,
  type CaseDocumentStatus,
} from "@/server/domain/documents/contracts";
import { QuestionnaireService } from "@/server/domain/questionnaire/service";

export const DOCUMENT_FORBIDDEN = "DOCUMENT_FORBIDDEN";
export const DOCUMENT_CASE_NOT_FOUND = "DOCUMENT_CASE_NOT_FOUND";
export const DOCUMENT_INVALID_CODE = "DOCUMENT_INVALID_CODE";
export const DOCUMENT_INVALID_TRANSITION = "DOCUMENT_INVALID_TRANSITION";

export type DocumentDefinition = {
  code: string;
  requiredFieldIds: readonly string[];
};

export type DocumentDefinitionRegistry = ReadonlyMap<string, DocumentDefinition>;

function calculateStatus(
  requiredFieldIds: readonly string[],
  answers: Record<string, string | number | boolean>,
): CaseDocumentStatus {
  const present = requiredFieldIds.filter((fieldId) => {
    const value = answers[fieldId];
    return value !== undefined && value !== "";
  }).length;

  if (present === 0) return "WAITING_DATA";
  if (present === requiredFieldIds.length) return "READY_FOR_REVIEW";
  return "DRAFT";
}

export class CaseDocumentService {
  constructor(
    private readonly cases: ClientCaseService,
    private readonly questionnaires: QuestionnaireService,
    private readonly repository: CaseDocumentRepository,
    private readonly definitions: DocumentDefinitionRegistry,
  ) {}

  private definition(documentCode: string) {
    const definition = this.definitions.get(documentCode);
    if (!definition) throw new Error(DOCUMENT_INVALID_CODE);
    return definition;
  }

  private async requireAccessibleCase(actor: AuthenticatedActor, clientCaseId: string) {
    const clientCase = await this.cases.getCase(actor, { caseId: clientCaseId });
    if (!clientCase) throw new Error(DOCUMENT_CASE_NOT_FOUND);
    return clientCase;
  }

  private async requireClientEditor(actor: AuthenticatedActor, clientCaseId: string) {
    const clientCase = await this.requireAccessibleCase(actor, clientCaseId);
    if (!actor.roles.includes("CLIENT") || clientCase.clientId !== actor.userId) {
      throw new Error(DOCUMENT_FORBIDDEN);
    }
    return clientCase;
  }

  private async requireReviewer(actor: AuthenticatedActor, clientCaseId: string) {
    const clientCase = await this.requireAccessibleCase(actor, clientCaseId);
    if (clientCase.clientId === actor.userId) {
      throw new Error(DOCUMENT_FORBIDDEN);
    }
    const manager = actor.roles.includes("MANAGER");
    const assignedLawyer =
      actor.roles.includes("LAWYER") && clientCase.assignedLawyerId === actor.userId;
    if (!manager && !assignedLawyer) throw new Error(DOCUMENT_FORBIDDEN);
    return clientCase;
  }

  async list(actor: AuthenticatedActor, clientCaseId: string) {
    await this.requireAccessibleCase(actor, clientCaseId);
    return this.repository.listByCase(clientCaseId);
  }

  async get(actor: AuthenticatedActor, clientCaseId: string, documentCode: string) {
    await this.requireAccessibleCase(actor, clientCaseId);
    this.definition(documentCode);
    return this.repository.getByCaseAndCode(clientCaseId, documentCode);
  }

  async getOrCreateForClient(
    actor: AuthenticatedActor,
    clientCaseId: string,
    documentCode: string,
  ): Promise<CaseDocumentRecord> {
    await this.requireClientEditor(actor, clientCaseId);
    const definition = this.definition(documentCode);
    const existing = await this.repository.getByCaseAndCode(clientCaseId, documentCode);
    if (existing) return existing;

    const questionnaire = await this.questionnaires.get(actor, clientCaseId);
    const status = calculateStatus(definition.requiredFieldIds, questionnaire?.answers ?? {});
    return this.repository.createForCase({ clientCaseId, documentCode, status });
  }

  async regenerate(
    actor: AuthenticatedActor,
    input: { clientCaseId: string; documentCode: string; expectedVersion: number },
  ) {
    await this.requireClientEditor(actor, input.clientCaseId);
    const definition = this.definition(input.documentCode);
    const questionnaire = await this.questionnaires.get(actor, input.clientCaseId);
    const status = calculateStatus(definition.requiredFieldIds, questionnaire?.answers ?? {});

    const existing = await this.repository.getByCaseAndCode(
      input.clientCaseId,
      input.documentCode,
    );
    if (!existing) throw new Error(DOCUMENT_NOT_FOUND);

    return this.repository.regenerate({ ...input, status, auditActorUserId: actor.userId });
  }

  async sendForReview(
    actor: AuthenticatedActor,
    input: { clientCaseId: string; documentCode: string; expectedVersion: number },
  ) {
    await this.requireClientEditor(actor, input.clientCaseId);
    this.definition(input.documentCode);
    const current = await this.repository.getByCaseAndCode(
      input.clientCaseId,
      input.documentCode,
    );
    if (!current || current.status !== "READY_FOR_REVIEW") {
      throw new Error(DOCUMENT_INVALID_TRANSITION);
    }
    return this.repository.sendForReview({ ...input, auditActorUserId: actor.userId });
  }

  async markReviewed(
    actor: AuthenticatedActor,
    input: { clientCaseId: string; documentCode: string; expectedVersion: number },
  ) {
    await this.requireReviewer(actor, input.clientCaseId);
    this.definition(input.documentCode);
    const current = await this.repository.getByCaseAndCode(
      input.clientCaseId,
      input.documentCode,
    );
    if (!current || current.status !== "SENT_FOR_REVIEW") {
      throw new Error(DOCUMENT_INVALID_TRANSITION);
    }
    return this.repository.markReviewed({ ...input, auditActorUserId: actor.userId });
  }
}
