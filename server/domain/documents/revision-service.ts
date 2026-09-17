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

export const DOCUMENT_REVISION_FORBIDDEN = "DOCUMENT_REVISION_FORBIDDEN";
export const DOCUMENT_REVISION_CASE_NOT_FOUND = "DOCUMENT_REVISION_CASE_NOT_FOUND";

export class CaseDocumentRevisionService {
  constructor(
    private readonly cases: ClientCaseService,
    private readonly documents: CaseDocumentRepository,
    private readonly revisions: CaseDocumentRevisionRepository,
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
      templateVersion: number;
      templateSourceHash: string;
      questionnaireVersion: number;
      sourceData: DocumentSourceValue;
    },
  ) {
    await this.requireClientEditor(actor, input.clientCaseId);
    const document = await this.requireDocument(actor, input.clientCaseId, input.documentCode);
    if (!Number.isInteger(input.templateVersion) || input.templateVersion < 1) {
      throw new Error(DOCUMENT_REVISION_INVALID_SOURCE);
    }
    if (!Number.isInteger(input.questionnaireVersion) || input.questionnaireVersion < 1) {
      throw new Error(DOCUMENT_REVISION_INVALID_SOURCE);
    }
    assertSha256(input.templateSourceHash);

    return this.revisions.createDraft({
      caseDocumentId: document.id,
      createdByUserId: actor.userId,
      templateCode: input.documentCode,
      templateVersion: input.templateVersion,
      templateSourceHash: input.templateSourceHash,
      questionnaireVersion: input.questionnaireVersion,
      sourceDataHash: hashDocumentSource(input.sourceData),
      sourceData: input.sourceData,
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
    const reviewNote = input.reviewNote?.trim() || null;
    if (reviewNote && reviewNote.length > 4000) throw new Error(DOCUMENT_REVISION_INVALID_SOURCE);
    return this.revisions.approve({
      revisionId: revision.id,
      reviewerUserId: actor.userId,
      reviewNote,
    });
  }
}
