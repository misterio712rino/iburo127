import "server-only";

import {
  assertSafeSignedUrlTtl,
  type CreateDownloadUrlInput,
  type CreateUploadUrlInput,
  type PrivateObjectStorage,
  type SignedObjectUrl,
  type StoredObjectMetadata,
} from "@/server/files/object-storage-contract";
import { assertSafeObjectKey } from "@/server/files/object-key";

export const VERCEL_BLOB_STORAGE_PROVIDER = "vercel-blob";

export type VercelBlobStorageDriver = {
  createPrivateUploadUrl(input: {
    pathname: string;
    mimeType: string;
    expiresInSeconds: number;
  }): Promise<string>;
  createPrivateDownloadUrl(input: {
    pathname: string;
    fileName?: string;
    expiresInSeconds: number;
  }): Promise<string>;
  statPrivateBlob(pathname: string): Promise<StoredObjectMetadata | null>;
  deletePrivateBlob(pathname: string): Promise<void>;
};

function result(url: string, expiresInSeconds: number): SignedObjectUrl {
  return {
    url,
    expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
  };
}

/**
 * Provider-neutral PrivateObjectStorage implementation for Vercel Blob.
 *
 * The concrete SDK/transport driver is injected so domain/runtime code does not
 * depend on @vercel/blob and the security boundary can be tested independently.
 */
export class VercelBlobPrivateObjectStorage implements PrivateObjectStorage {
  readonly providerCode = VERCEL_BLOB_STORAGE_PROVIDER;

  constructor(private readonly driver: VercelBlobStorageDriver) {}

  async createUploadUrl(input: CreateUploadUrlInput) {
    assertSafeObjectKey(input.objectKey);
    assertSafeSignedUrlTtl(input.expiresInSeconds);

    const url = await this.driver.createPrivateUploadUrl({
      pathname: input.objectKey,
      mimeType: input.mimeType,
      expiresInSeconds: input.expiresInSeconds,
    });
    return result(url, input.expiresInSeconds);
  }

  async createDownloadUrl(input: CreateDownloadUrlInput) {
    assertSafeObjectKey(input.objectKey);
    assertSafeSignedUrlTtl(input.expiresInSeconds);

    const url = await this.driver.createPrivateDownloadUrl({
      pathname: input.objectKey,
      fileName: input.fileName,
      expiresInSeconds: input.expiresInSeconds,
    });
    return result(url, input.expiresInSeconds);
  }

  async statObject(objectKey: string) {
    assertSafeObjectKey(objectKey);
    return this.driver.statPrivateBlob(objectKey);
  }

  async deleteObject(objectKey: string) {
    assertSafeObjectKey(objectKey);
    await this.driver.deletePrivateBlob(objectKey);
  }
}
