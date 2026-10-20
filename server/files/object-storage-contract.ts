import "server-only";

export const PRIVATE_OBJECT_MAX_READ_BYTES = 50 * 1024 * 1024;
export const OBJECT_STORAGE_READ_INVALID_LIMIT = "OBJECT_STORAGE_READ_INVALID_LIMIT";
export const OBJECT_STORAGE_READ_TOO_LARGE = "OBJECT_STORAGE_READ_TOO_LARGE";
export const OBJECT_STORAGE_READ_INCOMPLETE = "OBJECT_STORAGE_READ_INCOMPLETE";
export const OBJECT_STORAGE_READ_UNAVAILABLE = "OBJECT_STORAGE_READ_UNAVAILABLE";

export type SignedObjectUrl = {
  url: string;
  expiresAt: Date;
};

export type StoredObjectMetadata = {
  sizeBytes: bigint;
  mimeType: string | null;
};

export type CreateUploadUrlInput = {
  objectKey: string;
  mimeType: string;
  sizeBytes: bigint;
  expiresInSeconds: number;
  allowOverwrite?: boolean;
};

export type CreateDownloadUrlInput = {
  objectKey: string;
  fileName?: string;
  expiresInSeconds: number;
};

/** Provider-neutral private object storage boundary. */
export interface PrivateObjectStorage {
  providerCode: string;
  createUploadUrl(input: CreateUploadUrlInput): Promise<SignedObjectUrl>;
  createDownloadUrl(input: CreateDownloadUrlInput): Promise<SignedObjectUrl>;
  statObject(objectKey: string): Promise<StoredObjectMetadata | null>;
  readObject(objectKey: string, maxBytes: number): Promise<Uint8Array>;
  deleteObject(objectKey: string): Promise<void>;
}

export function assertSafeObjectReadLimit(maxBytes: number) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > PRIVATE_OBJECT_MAX_READ_BYTES) {
    throw new Error(OBJECT_STORAGE_READ_INVALID_LIMIT);
  }
}

/** Collect a private storage stream while enforcing the byte cap during the read. */
export async function collectBoundedPrivateObjectBytes(input: {
  body: AsyncIterable<Uint8Array> | null | undefined;
  maxBytes: number;
  expectedBytes?: number;
}) {
  assertSafeObjectReadLimit(input.maxBytes);
  if (
    input.expectedBytes !== undefined &&
    (!Number.isSafeInteger(input.expectedBytes) || input.expectedBytes < 1)
  ) {
    throw new Error(OBJECT_STORAGE_READ_UNAVAILABLE);
  }
  if (input.expectedBytes !== undefined && input.expectedBytes > input.maxBytes) {
    throw new Error(OBJECT_STORAGE_READ_TOO_LARGE);
  }
  if (!input.body) throw new Error(OBJECT_STORAGE_READ_UNAVAILABLE);

  const chunks: Uint8Array[] = [];
  let total = 0;
  for await (const chunk of input.body) {
    if (!(chunk instanceof Uint8Array)) {
      throw new Error(OBJECT_STORAGE_READ_UNAVAILABLE);
    }
    total += chunk.byteLength;
    if (total > input.maxBytes) throw new Error(OBJECT_STORAGE_READ_TOO_LARGE);
    chunks.push(chunk);
  }
  if (total < 1 || (input.expectedBytes !== undefined && total !== input.expectedBytes)) {
    throw new Error(OBJECT_STORAGE_READ_INCOMPLETE);
  }

  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

export function assertSafeSignedUrlTtl(expiresInSeconds: number) {
  if (!Number.isInteger(expiresInSeconds) || expiresInSeconds < 30 || expiresInSeconds > 900) {
    throw new Error("OBJECT_STORAGE_INVALID_TTL");
  }
}

export function toSafeUploadSizeNumber(sizeBytes: bigint) {
  if (sizeBytes <= BigInt(0) || sizeBytes > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("OBJECT_STORAGE_INVALID_UPLOAD_SIZE");
  }
  return Number(sizeBytes);
}
