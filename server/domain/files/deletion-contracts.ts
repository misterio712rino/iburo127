import type { StoredFileStatus } from "@/server/domain/files/contracts";

export type StoredFileDeletionStatus =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "REQUIRES_ATTENTION";

export type StoredFileDeletionRecord = {
  fileId: string;
  clientCaseId: string;
  requestedByUserId: string;
  storageProvider: string;
  objectKey: string;
  originalFileStatus: StoredFileStatus;
  status: StoredFileDeletionStatus;
  attemptCount: number;
  nextAttemptAt: Date | null;
  leaseUntil: Date | null;
  leaseToken: string | null;
  lastErrorCode: string | null;
  requestedAt: Date;
  storageConfirmedAt: Date | null;
  completedAt: Date | null;
  completionActivityEventId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ClaimedStoredFileDeletion = StoredFileDeletionRecord & {
  status: "PROCESSING";
  leaseToken: string;
};

export type StoredFileDeletionIntent = {
  fileId: string;
  clientCaseId: string;
  requestedByUserId: string;
  storageProvider: string;
  objectKey: string;
  originalFileStatus: StoredFileStatus;
};

export interface StoredFileDeletionRepository {
  getByFileId(fileId: string): Promise<StoredFileDeletionRecord | null>;
  claimDueDeletion(input: {
    now: Date;
    leaseUntil: Date;
  }): Promise<ClaimedStoredFileDeletion | null>;
  rescheduleDeletion(input: {
    fileId: string;
    leaseToken: string;
    nextAttemptAt: Date;
    errorCode: string;
  }): Promise<boolean>;
  markDeletionRequiresAttention(input: {
    fileId: string;
    leaseToken: string;
    errorCode: string;
  }): Promise<boolean>;
  finalizeDeletion(input: {
    fileId: string;
    leaseToken: string;
    storageConfirmedAt: Date;
    completedAt: Date;
  }): Promise<boolean>;
}
