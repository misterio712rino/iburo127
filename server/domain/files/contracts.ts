export type StoredFileRecord = {
  id: string;
  clientCaseId: string;
  uploadedById: string | null;
  storageProvider: string;
  objectKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: bigint;
  checksumSha256: string | null;
  createdAt: Date;
};

export interface StoredFileRepository {
  listByCase(clientCaseId: string): Promise<readonly StoredFileRecord[]>;
  getById(fileId: string): Promise<StoredFileRecord | null>;
  create(input: {
    clientCaseId: string;
    uploadedById: string | null;
    storageProvider: string;
    objectKey: string;
    fileName: string;
    mimeType: string;
    sizeBytes: bigint;
    checksumSha256?: string | null;
  }): Promise<StoredFileRecord>;
}
