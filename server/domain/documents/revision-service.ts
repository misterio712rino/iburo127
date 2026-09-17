import { clientPlanHasHumanSupport } from "@/lib/platform/client-plan-entitlements";
import type { AuthenticatedActor } from "@/server/domain/client-cases/contracts";
import { ClientCaseService } from "@/server/domain/client-cases/service";
import type { CaseDocumentRepository } from "@/server/domain/documents/contracts";
import {
  DOCUMENT_REVISION_INVALID_SOURCE,
  DOCUMENT_REVISION_INVALID_TRANSITION,
  DOCUMENT_REVISION_NOT_FOUND,
  type CaseDocumentRevisionRepository,
  type DocumentSourceValue,
} from "@/server/domain/documents/revision-contracts";
import { assertSha256, hashDocumentSource } from "@/server/domain/documents/revision-source";
import { buildDocumentSourceDraft } from "@/server/domain/documents/source-draft";
import {
  DOCUMENT_TEMPLATE_NOT_REGISTERED,
  type DocumentTemplateRegistry,
} from "@/server/domain/documents/template-contracts";
import type { QuestionnaireRepository } from "@/server/domain/questionnaire/contracts";

export const DOCUMENT_REVISION_FORBIDDEN = "DOCUMENT_REVISION_FORBIDDEN";
export const DOCUMENT_REVISION_CASE_NOT_FOUND = "DOCUMENT_REVISION_CASE_NOT_FOUND";

function toDocumentSourceValue(value: unknown): DocumentSourceValue {
  return JSON.parse(JSON.stringify(value)) as DocumentSourceValue;
}

export class CaseDocumentRevisionService {
  constructor(
    private readonly cases: ClientCaseService,
    private readonly documents: CaseDocumentRepository,
    private readonly revisions: CaseDocumentRevisionRepository,
    private readonly templates: DocumentTemplateRegistry,
    private readonly questionnaires: QuestionnaireRepository,
  ) {}

  private async requireClientEditor(actor: AuthenticatedActor, clientCaseId: string) {
    const clientCase = await this.cases.getCase(actor, { caseId: clientCaseId });
    if (!clientCase) throw new Error(DOCUMENT_REVISION_CASE_NOT_FOUND);
    if (!actor.roles.includes("CLIENT") || clientCase.clientId !== actor.userId) {
      throw new Error(DOCUMENT_REVISION_FORBIDDEN);
    }
    return clientCase;
  }

  private async requireReviewer(actor: AuthenticatedActor, clientCaseId: string) {
    const clientCase = await this.cases.getCase(actor, { caseId: clientCaseId });
    if (!clientCase) throw new Error(DOCUMENT_REVISION_CASE_NOT_FOUND);
    const allowed =
      clientPlanHasHumanSupport(clientCase.planCode) &&
      actor.roles.includes("LAWYER") &&
      !actor.roles.includes("MANAGER") &&
      clientCase.clientId !== actor.userId &&
      clientCase.assignedLawyerId === actor.userId;
    if (!allowed) throw new Error(DOCUMENT_REVISION_FORBIDDEN);
    return clientCase;
  }

  private async requireDocument(
    actor: AuthenticatedActor,
    clientCaseId: string,
    documentCode: string,
  ) {
    const document = await this.documents.getByCaseAndCode(clientCaseId, documentCode, actor);
    if (!document) throw new Error(DOCUMENT_REVISION_NOT_FOUND);
    return document;
  }

  async getLatest(actor: AuthenticatedActor, clientCaseId: string, documentCode: string) {
    const clientCase = await this.cases.getCase(actor, { caseId: clientCaseId });
    if (!clientCase) throw new Error(DOCUMENT_REVISION_CASE_NOT_FOUND);
    const document = await this.requireDocument(actor, clientCaseId, documentCode);
    return this.revisions.getLatest(document.id);
  }

  async createDraft(
    actor: AuthenticatedActor,
    input: {
      clientCaseId: string;
      documentCode: string;
    },
  ) {
    await this.requireClientEditor(actor, input.clientCaseId);
    const document = await this.requireDocument(actor, input.clientCaseId, input.documentCode);
    const questionnaire = await this.questionnaires.getByClientCaseId(input.clientCaseId, actor);
    if (!questionnaire || !Number.isSafeInteger(questionnaire.version) || questionnaire.version < 1) {
      throw new Error(DOCUMENT_REVISION_INVALID_SOURCE);
    }

    const template = await this.templates.getActive(input.documentCode);
    if (!template || template.documentCode !== input.documentCode) {
      throw new Error(DOCUMENT_TEMPLATE_NOT_REGISTERED);
    }
    if (!Number.isInteger(template.version) || template.version < 1) {
      throw new Error(DOCUMENT_REVISION_INVALID_SOURCE);
    }
    assertSha256(template.sourceSha256);

    const sourceDraft = buildDocumentSourceDraft({
      documentCode: input.documentCode,
      questionnaireSchemaVersion: questionnaire.schemaVersion,
      questionnaireVersion: questionnaire.version,
      answers: questionnaire.answers,
    });
    const sourceData = toDocumentSourceValue(sourceDraft);

    return this.revisions.createDraft({
      caseDocumentId: document.id,
      createdByUserId: actor.userId,
      templateCode: template.documentCode,
      templateVersion: template.version,
      templateSourceHash: template.sourceSha256,
      questionnaireVersion: questionnaire.version,
      sourceDataHash: hashDocumentSource(sourceData),
      sourceData,
    });
  }

  async submitForReview(
    actor: AuthenticatedActor,
    input: { clientCaseId: string; documentCode: string; revisionId: string },
  ) {
    const clientCase = await this.requireClientEditor(actor, input.clientCaseId);
    if (!clientPlanHasHumanSupport(clientCase.planCode) || !clientCase.assignedLawyerId) {
      throw new Error(DOCUMENT_REVISION_FORBIDDEN);
    }
    const document = await this.requireDocument(actor, input.clientCaseId, input.documentCode);
    const revision = await this.revisions.getById(input.revisionId);
    if (!revision || revision.caseDocumentId !== document.id) throw new Error(DOCUMENT_REVISION_NOT_FOUND);
    if (revision.status !== "DRAFT" && revision.status !== "CHANGES_REQUESTED") {
      throw new Error(DOCUMENT_REVISION_INVALID_TRANSITION);
    }
    if (hashDocumentSource(revision.sourceData) !== revision.sourceDataHash) {
      throw new Error(DOCUMENT_REVISION_INVALID_SOURCE);
    }
    const activeTemplate = await this.templates.getActive(input.documentCode);
    if (
      !activeTemplate ||
      activeTemplate.version !== revision.templateVersion ||
      activeTemplate.sourceSha256 !== revision.templateSourceHash
    ) {
      throw new Error(DOCUMENT_TEMPLATE_NOT_REGISTERED);
    }
    return this.revisions.submitForReview({
      revisionId: revision.id,
      submittedByUserId: actor.userId,
    });
  }

  async requestChanges(
    actor: AuthenticatedActor,
    input: {
      clientCaseId: string;
      documentCode: string;
      revisionId: string;
      reviewNote: string;
    },
  ) {
    await this.requireReviewer(actor, input.clientCaseId);
    const document = await this.requireDocument(actor, input.clientCaseId, input.documentCode);
    const revision = await this.revisions.getById(input.revisionId);
    if (!revision || revision.caseDocumentId !== document.id) throw new Error(DOCUMENT_REVISION_NOT_FOUND);
    if (revision.status !== "IN_REVIEW") throw new Error(DOCUMENT_REVISION_INVALID_TRANSITION);
    const reviewNote = input.reviewNote.trim();
    if (!reviewNote || reviewNote.length > 4000) throw new Error(DOCUMENT_REVISION_INVALID_SOURCE);
    return this.revisions.requestChanges({
      revisionId: revision.id,
      reviewerUserId: actor.userId,
      reviewNote,
    });
  }

  async approve(
    actor: AuthenticatedActor,
    input: {
      clientCaseId: string;
      documentCode: string;
      revisionId: string;
      reviewNote?: string | null;
    },
  ) {
    await this.requireReviewer(actor, input.clientCaseId);
    const document = await this.requireDocument(actor, input.clientCaseId, input.documentCode);
    const revision = await this.revisions.getById(input.revisionId);
    if (!revision || revision.caseDocumentId !== document.id) throw new Error(DOCUMENT_REVISION_NOT_FOUND);
    if (revision.status !== "IN_REVIEW") throw new Error(DOCUMENT_REVISION_INVALID_TRANSITION);
    if (hashDocumentSource(revision.sourceData) !== revision.sourceDataHash) {
      throw new Error(DOCUMENT_REVISION_INVALID_SOURCE);
    }
    assertSha256(revision.templateSourceHash);
    const reviewNote = input.reviewNote?.trim() || null;
    if (reviewNote && reviewNote.length > 4000) throw new Error(DOCUMENT_REVISION_INVALID_SOURCE);
    return this.revisions.approve({
      revisionId: revision.id,
      reviewerUserId: actor.userId,
      reviewNote,
    });
  }
}
