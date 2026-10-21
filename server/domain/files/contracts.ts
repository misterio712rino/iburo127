import type { AuthenticatedActor } from "@/server/domain/client-cases/contracts";

export type StoredFileStatus =
  | "PENDING_UPLOAD"
  | "PENDING_SCAN"
  | "SCANNING"
  | "READY"
  | "QUARANTINED"
  | "SCAN_FAILED";

export type StoredFileRecord = {
  id: string;
  clientCaseId: string;
  uploadedById: string | null;
  status: StoredFileStatus;
  storageProvider: string;
  objectKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: bigint;
  checksumSha256: string | null;
  scanAttemptCount: number;
  scanNextAttemptAt: Date | null;
  scanLeaseUntil: Date | null;
  scanLeaseToken: string | null;
  scanProvider: string | null;
  scanLastErrorCode: string | null;
  scannedAt: Date | null;
  quarantinedAt: Date | null;
  readyAt: Date | null;
  createdAt: Date;
};

export type ClaimedStoredFileScan = StoredFileRecord & {
  status: "SCANNING";
  scanLeaseToken: string;
};

export type DocumentProcessingJobDeletionSnapshot = {
  id: string;
  clientCaseId: string;
  sourceFileId: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED";
  attemptCount: number;
  nextAttemptAt: Date;
  leaseUntil: Date | null;
  leaseToken: string | null;
  lastErrorCode: string | null;
  pageTexts: string[] | null;
  pageCount: number | null;
  completedAt: Date | null;
  failedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ExtractedFactCandidateDeletionSnapshot = {
  id: string;
  clientCaseId: string;
  sourceFileId: string;
  fieldPath: string;
  recordKey: string;
  sourcePage: number;
  value: unknown;
  confidence: number;
  reviewStatus: "NEEDS_REVIEW" | "CONFIRMED" | "REJECTED";
  reviewedAt: Date | null;
  reviewedById: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type StoredFileDeletionSnapshot = {
  file: StoredFileRecord;
  processingJob: DocumentProcessingJobDeletionSnapshot | null;
  extractedFacts: ExtractedFactCandidateDeletionSnapshot[];
};

export interface StoredFileRepository {
  listByCase(
    clientCaseId: string,
    actor: AuthenticatedActor,
  ): Promise<readonly StoredFileRecord[]>;
  getById(fileId: string, actor: AuthenticatedActor): Promise<StoredFileRecord | null>;
  listPendingBefore(before: Date, limit: number): Promise<readonly StoredFileRecord[]>;
  create(input: {
    id: string;
    clientCaseId: string;
    uploadedById: string | null;
    status: StoredFileStatus;
    storageProvider: string;
    objectKey: string;
    fileName: string;
    mimeType: string;
    sizeBytes: bigint;
    checksumSha256?: string | null;
  }): Promise<StoredFileRecord>;
  markPendingScan(
    fileId: string,
    scanNextAttemptAt: Date,
    auditActorUserId: string,
  ): Promise<StoredFileRecord | null>;
  claimDueScan(input: {
    now: Date;
    leaseUntil: Date;
  }): Promise<ClaimedStoredFileScan | null>;
  markScanClean(input: {
    fileId: string;
    leaseToken: string;
    providerCode: string;
    scannedAt: Date;
  }): Promise<StoredFileRecord | null>;
  markScanQuarantined(input: {
    fileId: string;
    leaseToken: string;
    providerCode: string;
    scannedAt: Date;
  }): Promise<StoredFileRecord | null>;
  rescheduleScan(input: {
    fileId: string;
    leaseToken: string;
    nextAttemptAt: Date;
    providerCode: string;
    errorCode: string;
  }): Promise<boolean>;
  markScanFailed(input: {
    fileId: string;
    leaseToken: string;
    providerCode: string;
    scannedAt: Date;
    errorCode: string;
  }): Promise<boolean>;
  /** Optional capability used by the interactive client deletion flow. */
  takeOwnedForDeletion?(fileId: string, uploadedById: string): Promise<StoredFileDeletionSnapshot | null>;
  /** Optional capability paired with takeOwnedForDeletion for storage-failure recovery. */
  restoreDeleted?(snapshot: StoredFileDeletionSnapshot): Promise<boolean>;
  deletePending(fileId: string): Promise<boolean>;
  restorePending(file: StoredFileRecord): Promise<boolean>;
}
