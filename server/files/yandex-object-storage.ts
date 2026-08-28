import "server-only";

import {
  assertSafeSignedUrlTtl,
  type CreateDownloadUrlInput,
  type CreateUploadUrlInput,
  type PrivateObjectStorage,
  type SignedObjectUrl,
} from "@/server/files/object-storage-contract";

export const YANDEX_OBJECT_STORAGE_PROVIDER = "yandex-object-storage";
export const OBJECT_STORAGE_INVALID_KEY = "OBJECT_STORAGE_INVALID_KEY";

export type YandexObjectStorageSigner = {
  signUpload(input: {
    bucket: string;
    objectKey: string;
    mimeType: string;
    expiresInSeconds: number;
  }): Promise<string>;
  signDownload(input: {
    bucket: string;
    objectKey: string;
    fileName?: string;
    expiresInSeconds: number;
  }): Promise<string>;
  deleteObject(input: { bucket: string; objectKey: string }): Promise<void>;
};

function assertSafeObjectKey(objectKey: string) {
  if (
    !objectKey ||
    objectKey.length > 1500 ||
    objectKey.startsWith("/") ||
    objectKey.includes("..") ||
    objectKey.includes("\\") ||
    /[\r\n\0]/.test(objectKey)
  ) {
    throw new Error(OBJECT_STORAGE_INVALID_KEY);
  }
}

function result(url: string, expiresInSeconds: number): SignedObjectUrl {
  return {
    url,
    expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
  };
}

export class YandexPrivateObjectStorage implements PrivateObjectStorage {
  readonly providerCode = YANDEX_OBJECT_STORAGE_PROVIDER;

  constructor(
    private readonly bucket: string,
    private readonly signer: YandexObjectStorageSigner,
  ) {
    if (!bucket.trim()) throw new Error("OBJECT_STORAGE_INVALID_BUCKET");
  }

  async createUploadUrl(input: CreateUploadUrlInput) {
    assertSafeObjectKey(input.objectKey);
    assertSafeSignedUrlTtl(input.expiresInSeconds);
    const url = await this.signer.signUpload({ bucket: this.bucket, ...input });
    return result(url, input.expiresInSeconds);
  }

  async createDownloadUrl(input: CreateDownloadUrlInput) {
    assertSafeObjectKey(input.objectKey);
    assertSafeSignedUrlTtl(input.expiresInSeconds);
    const url = await this.signer.signDownload({ bucket: this.bucket, ...input });
    return result(url, input.expiresInSeconds);
  }

  async deleteObject(objectKey: string) {
    assertSafeObjectKey(objectKey);
    await this.signer.deleteObject({ bucket: this.bucket, objectKey });
  }
}

export function createStoredFileObjectKey(input: {
  clientCaseId: string;
  fileId: string;
  extension?: string | null;
}) {
  const clientCaseId = input.clientCaseId.trim();
  const fileId = input.fileId.trim();
  if (!/^[0-9a-f-]{36}$/i.test(clientCaseId) || !/^[0-9a-f-]{36}$/i.test(fileId)) {
    throw new Error(OBJECT_STORAGE_INVALID_KEY);
  }

  const extension = input.extension?.trim().toLowerCase();
  if (extension && !/^[a-z0-9]{1,10}$/.test(extension)) {
    throw new Error(OBJECT_STORAGE_INVALID_KEY);
  }

  return `cases/${clientCaseId}/${fileId}/object${extension ? `.${extension}` : ""}`;
}
