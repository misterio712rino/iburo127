import "server-only";

export type SignedObjectUrl = {
  url: string;
  expiresAt: Date;
};

export type CreateUploadUrlInput = {
  objectKey: string;
  mimeType: string;
  expiresInSeconds: number;
};

export type CreateDownloadUrlInput = {
  objectKey: string;
  fileName?: string;
  expiresInSeconds: number;
};

/**
 * Provider-neutral private object storage boundary.
 * Implementations must keep buckets private and return short-lived signed URLs.
 */
export interface PrivateObjectStorage {
  providerCode: string;

  createUploadUrl(input: CreateUploadUrlInput): Promise<SignedObjectUrl>;
  createDownloadUrl(input: CreateDownloadUrlInput): Promise<SignedObjectUrl>;
  deleteObject(objectKey: string): Promise<void>;
}

export function assertSafeSignedUrlTtl(expiresInSeconds: number) {
  if (!Number.isInteger(expiresInSeconds) || expiresInSeconds < 30 || expiresInSeconds > 900) {
    throw new Error("OBJECT_STORAGE_INVALID_TTL");
  }
}
