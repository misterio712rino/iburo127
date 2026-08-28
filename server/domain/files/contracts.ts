export type StoredFileStatus = "PENDING_UPLOAD" | "READY";

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
  readyAt: Date | null;
  createdAt: Date;
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
  markReady(
    fileId: string,
    readyAt: Date,
    auditActorUserId: string,
  ): Promise<StoredFileRecord | null>;
  deletePending(fileId: string): Promise<boolean>;
  restorePending(file: StoredFileRecord): Promise<boolean>;
}
