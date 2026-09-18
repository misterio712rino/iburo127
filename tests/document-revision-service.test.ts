import assert from "node:assert/strict";

import type { AuthenticatedActor, ClientCaseRecord, ClientCaseRepository } from "@/server/domain/client-cases/contracts";
import { ClientCaseService } from "@/server/domain/client-cases/service";
import type { CaseDocumentRepository } from "@/server/domain/documents/contracts";
import { DOCUMENT_REVISION_ARTIFACT_MISSING } from "@/server/domain/documents/revision-approval-guard";
import {
  DOCUMENT_REVISION_INVALID_SOURCE,
  DOCUMENT_REVISION_INVALID_TRANSITION,
  type CaseDocumentRevisionRecord,
  type CaseDocumentRevisionRepository,
} from "@/server/domain/documents/revision-contracts";
import { CaseDocumentRevisionService } from "@/server/domain/documents/revision-service";
import { hashDocumentSource } from "@/server/domain/documents/revision-source";
import { DOCUMENT_TEMPLATE_NOT_REGISTERED, type DocumentTemplateRegistry } from "@/server/domain/documents/template-contracts";
import type { QuestionnaireRecord, QuestionnaireRepository } from "@/server/domain/questionnaire/contracts";

const client: AuthenticatedActor = { userId: "client", roles: ["CLIENT"] };
const lawyer: AuthenticatedActor = { userId: "lawyer", roles: ["LAWYER"] };
const stranger: AuthenticatedActor = { userId: "stranger", roles: ["CLIENT"] };
const otherLawyer: AuthenticatedActor = { userId: "other-lawyer", roles: ["LAWYER"] };
const clientCase: ClientCaseRecord = {
  id: "case-1", caseNumber: "TEST-1", clientId: "client", planCode: "PRO",
  stageCode: "START", assignedLawyerId: "lawyer", status: "ACTIVE",
};
const cases = new ClientCaseService({
  async findAccessibleCase() { return clientCase; },
  async listAccessibleCases() { return [clientCase]; },
} satisfies ClientCaseRepository);

const document = {
  id: "document-1", clientCaseId: clientCase.id, documentCode: "creditors-list" as const,
  status: "DRAFT" as const, regeneratedAt: null, sentForReviewAt: null, reviewedAt: null,
  version: 1, createdAt: new Date(), updatedAt: new Date(),
};
const documents = {
  async getByCaseAndCode(caseId: string, code: string) {
    return caseId === clientCase.id && code === document.documentCode ? document : null;
  },
} as unknown as CaseDocumentRepository;

let currentQuestionnaireVersion = 7;
let answers: QuestionnaireRecord["answers"] = {
  fullName: "Test Applicant", creditorCount: 2, totalDebt: 500000,
  hasOverdue: true, hasEnforcement: false,
};
const questionnaires = {
  async getByClientCaseId(caseId: string) {
    if (caseId !== clientCase.id) return null;
    return {
      clientCaseId: caseId, schemaVersion: 1, version: currentQuestionnaireVersion,
      status: "COMPLETED", answers, completedSectionIds: [], startedAt: new Date(),
      completedAt: new Date(), createdAt: new Date(), updatedAt: new Date(),
    } satisfies QuestionnaireRecord;
  },
} as unknown as QuestionnaireRepository;

let registered = false;
const templates: DocumentTemplateRegistry = {
  async getActive(code: string) {
    return registered ? {
      documentCode: code, version: 1, sourceSha256: "a".repeat(64), sourceKind: "DOCX",
    } : null;
  },
};

let saved: CaseDocumentRevisionRecord | null = null;
let submitted = 0;
let returned = 0;
let approved = 0;
const revisions = {
  async getLatest() { return saved; },
  async getById(id: string) { return saved?.id === id ? saved : null; },
  async createDraft(input: {
    caseDocumentId: string; createdByUserId: string; templateCode: string;
    templateVersion: number; templateSourceHash: string; questionnaireVersion: number;
    sourceDataHash: string; sourceData: CaseDocumentRevisionRecord["sourceData"];
  }) {
    saved = {
      ...input, id: "revision-1", revisionNumber: 1, status: "DRAFT",
      submittedByUserId: null, submittedAt: null, reviewedByUserId: null,
      reviewNote: null, reviewedAt: null, approvedAt: null,
      createdAt: new Date(), updatedAt: new Date(),
    };
    return saved;
  },
  async submitForReview() {
    submitted++;
    saved = { ...saved!, status: "IN_REVIEW", submittedByUserId: client.userId, submittedAt: new Date() };
    return saved;
  },
  async requestChanges(input: { reviewNote: string; reviewerUserId: string }) {
    returned++;
    saved = { ...saved!, status: "CHANGES_REQUESTED", reviewNote: input.reviewNote, reviewedByUserId: input.reviewerUserId };
    return saved;
  },
  async approve() {
    approved++;
    saved = { ...saved!, status: "APPROVED" };
    return saved;
  },
} as CaseDocumentRevisionRepository;

const service = new CaseDocumentRevisionService(cases, documents, revisions, templates, questionnaires);
const selector = { clientCaseId: clientCase.id, documentCode: document.documentCode };
await assert.rejects(service.createDraft(client, selector), new RegExp(DOCUMENT_TEMPLATE_NOT_REGISTERED));
assert.equal(saved, null);
await assert.rejects(service.createDraft(stranger, selector), /DOCUMENT_REVISION_CASE_NOT_FOUND|DOCUMENT_REVISION_FORBIDDEN/);
registered = true;
const draft = await service.createDraft(client, selector);
assert.equal(draft.createdByUserId, client.userId);
assert.equal(draft.questionnaireVersion, 7);
assert.equal(draft.templateSourceHash, "a".repeat(64));
assert.equal(hashDocumentSource(draft.sourceData), draft.sourceDataHash);
assert.equal((draft.sourceData as { courtReady: boolean }).courtReady, false);
answers = { fullName: "Another Applicant" };
assert.equal((draft.sourceData as { answerSnapshot: { fullName: string } }).answerSnapshot.fullName, "Test Applicant");

const submission = { ...selector, revisionId: draft.id };
currentQuestionnaireVersion = 8;
await assert.rejects(service.submitForReview(client, submission), new RegExp(DOCUMENT_REVISION_INVALID_SOURCE));
assert.equal(submitted, 0);
currentQuestionnaireVersion = 7;
await assert.rejects(service.submitForReview(stranger, submission), /DOCUMENT_REVISION_CASE_NOT_FOUND|DOCUMENT_REVISION_FORBIDDEN/);
await assert.rejects(service.submitForReview(client, { ...submission, revisionId: "another-revision" }), /DOCUMENT_REVISION_NOT_FOUND/);
const review = await service.submitForReview(client, submission);
assert.equal(review.status, "IN_REVIEW");
assert.equal(submitted, 1);
await assert.rejects(service.submitForReview(client, submission), new RegExp(DOCUMENT_REVISION_INVALID_TRANSITION));
await assert.rejects(service.requestChanges(otherLawyer, { ...submission, reviewNote: "Fix" }), /DOCUMENT_REVISION_CASE_NOT_FOUND|DOCUMENT_REVISION_FORBIDDEN/);
await assert.rejects(service.requestChanges(lawyer, { ...submission, reviewNote: " " }), new RegExp(DOCUMENT_REVISION_INVALID_SOURCE));
const change = await service.requestChanges(lawyer, { ...submission, reviewNote: " Fix the details. " });
assert.equal(change.status, "CHANGES_REQUESTED");
assert.equal(change.reviewNote, "Fix the details.");
assert.equal(returned, 1);
await assert.rejects(service.approve(lawyer, submission), new RegExp(DOCUMENT_REVISION_INVALID_TRANSITION));
saved = { ...saved!, status: "IN_REVIEW" };
await assert.rejects(service.approve(lawyer, submission), new RegExp(DOCUMENT_REVISION_ARTIFACT_MISSING));
assert.equal(approved, 0);
console.log("DOCUMENT_REVISION_SERVICE_PASS");
