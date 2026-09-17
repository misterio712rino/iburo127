export const DOCUMENT_REVISION_NOT_FOUND = "DOCUMENT_REVISION_NOT_FOUND";
export const DOCUMENT_REVISION_INVALID_TRANSITION = "DOCUMENT_REVISION_INVALID_TRANSITION";
export const DOCUMENT_REVISION_INVALID_SOURCE = "DOCUMENT_REVISION_INVALID_SOURCE";

export type CaseDocumentRevisionStatus =
  | "DRAFT"
  | "IN_REVIEW"
  | "CHANGES_REQUESTED"
  | "APPROVED"
  | "SUPERSEDED";

export type DocumentSourceValue =
  | string
  | number
  | boolean
  | null
  | readonly DocumentSourceValue[]
  | { readonly [key: string]: DocumentSourceValue };

export type CaseDocumentRevisionRecord = {
  id: string;
  caseDocumentId: string;
  revisionNumber: number;
  templateCode: string;
  templateVersion: number;
  templateSourceHash: string;
  questionnaireVersion: number;
  sourceDataHash: string;
  sourceData: DocumentSourceValue;
  status: CaseDocumentRevisionStatus;
  submittedAt: Date | null;
  reviewedByUserId: string | null;
  reviewNote: string | null;
  reviewedAt: Date | null;
  approvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export interface CaseDocumentRevisionRepository {
  getLatest(caseDocumentId: string): Promise<CaseDocumentRevisionRecord | null>;
  createDraft(input: {
    caseDocumentId: string;
    templateCode: string;
    templateVersion: number;
    templateSourceHash: string;
    questionnaireVersion: number;
    sourceDataHash: string;
    sourceData: DocumentSourceValue;
  }): Promise<CaseDocumentRevisionRecord>;
  submitForReview(input: {
    revisionId: string;
    reviewerUserId: string;
  }): Promise<CaseDocumentRevisionRecord>;
  requestChanges(input: {
    revisionId: string;
    reviewerUserId: string;
    reviewNote: string;
  }): Promise<CaseDocumentRevisionRecord>;
  approve(input: {
    revisionId: string;
    reviewerUserId: string;
    reviewNote: string | null;
  }): Promise<CaseDocumentRevisionRecord>;
}
