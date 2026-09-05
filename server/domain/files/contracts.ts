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

export interface StoredFileRepository {
  listByCase(clientCaseId: string): Promise<readonly StoredFileRecord[]>;
  getById(fileId: string): Promise<StoredFileRecord | null>;
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
  takeOwnedForDeletion?(fileId: string, uploadedById: string): Promise<StoredFileRecord | null>;
  /** Optional capability paired with takeOwnedForDeletion for storage-failure recovery. */
  restoreDeleted?(file: StoredFileRecord): Promise<boolean>;
  deletePending(fileId: string): Promise<boolean>;
  restorePending(file: StoredFileRecord): Promise<boolean>;
}
