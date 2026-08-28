export const DOCUMENT_NOT_FOUND = "DOCUMENT_NOT_FOUND";
export const DOCUMENT_VERSION_CONFLICT = "DOCUMENT_VERSION_CONFLICT";

export type CaseDocumentStatus =
  | "WAITING_DATA"
  | "DRAFT"
  | "READY_FOR_REVIEW"
  | "SENT_FOR_REVIEW"
  | "REVIEWED";

export type CaseDocumentRecord = {
  id: string;
  clientCaseId: string;
  documentCode: string;
  status: CaseDocumentStatus;
  regeneratedAt: Date | null;
  sentForReviewAt: Date | null;
  reviewedAt: Date | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

export interface CaseDocumentRepository {
  getByCaseAndCode(clientCaseId: string, documentCode: string): Promise<CaseDocumentRecord | null>;
  listByCase(clientCaseId: string): Promise<readonly CaseDocumentRecord[]>;
  createForCase(input: {
    clientCaseId: string;
    documentCode: string;
    status: CaseDocumentStatus;
  }): Promise<CaseDocumentRecord>;
  regenerate(input: {
    clientCaseId: string;
    documentCode: string;
    status: CaseDocumentStatus;
    expectedVersion: number;
    auditActorUserId: string;
  }): Promise<CaseDocumentRecord>;
  sendForReview(input: {
    clientCaseId: string;
    documentCode: string;
    expectedVersion: number;
    auditActorUserId: string;
  }): Promise<CaseDocumentRecord>;
  markReviewed(input: {
    clientCaseId: string;
    documentCode: string;
    expectedVersion: number;
    auditActorUserId: string;
  }): Promise<CaseDocumentRecord>;
}
