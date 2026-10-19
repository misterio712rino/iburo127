import "server-only";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PRODUCTION_CONFIG_ERROR } from "@/server/config/production";
import {
  assertSafeObjectReadLimit,
  collectBoundedPrivateObjectBytes,
  assertSafeSignedUrlTtl,
  type CreateDownloadUrlInput,
  type CreateUploadUrlInput,
  type PrivateObjectStorage,
  type SignedObjectUrl,
  type StoredObjectMetadata,
} from "@/server/files/object-storage-contract";
import { TIMEWEB_OBJECT_STORAGE_PROVIDER } from "@/server/files/object-storage-provider";
import { isAwsS3NotFoundError } from "@/server/files/aws-s3-object-storage-errors";
import { OBJECT_STORAGE_INVALID_KEY } from "@/server/files/yandex-object-storage";
import { assertValidYandexStorageBucketName } from "@/server/files/yandex-storage-bucket-name";

export const TIMEWEB_S3_REGION = "ru-1";
export const TIMEWEB_S3_ENDPOINT = "https://s3.twcstorage.ru";

export type TimewebObjectStorageConfig = {
  bucket: string;
  region: typeof TIMEWEB_S3_REGION;
  endpoint: typeof TIMEWEB_S3_ENDPOINT;
  accessKeyId: string;
  secretAccessKey: string;
};

function requireEnv(env: NodeJS.ProcessEnv, name: string) {
  const value = env[name]?.trim();
  if (!value || /[\r\n\0]/.test(value)) {
    throw new Error(`${PRODUCTION_CONFIG_ERROR}:${name}`);
  }
  return value;
}

export function readTimewebObjectStorageConfig(
  env: NodeJS.ProcessEnv = process.env,
): TimewebObjectStorageConfig {
  let bucket: string;
  try {
    bucket = assertValidYandexStorageBucketName(requireEnv(env, "TIMEWEB_STORAGE_BUCKET"));
  } catch {
    throw new Error(`${PRODUCTION_CONFIG_ERROR}:TIMEWEB_STORAGE_BUCKET`);
  }
  return {
    bucket,
    region: TIMEWEB_S3_REGION,
    endpoint: TIMEWEB_S3_ENDPOINT,
    accessKeyId: requireEnv(env, "TIMEWEB_STORAGE_ACCESS_KEY_ID"),
    secretAccessKey: requireEnv(env, "TIMEWEB_STORAGE_SECRET_ACCESS_KEY"),
  };
}

export type TimewebObjectStorageSigner = {
  signUpload(input: { bucket: string; objectKey: string; mimeType: string; expiresInSeconds: number }): Promise<string>;
  signDownload(input: { bucket: string; objectKey: string; fileName?: string; expiresInSeconds: number }): Promise<string>;
  statObject(input: { bucket: string; objectKey: string }): Promise<StoredObjectMetadata | null>;
  readObject(input: { bucket: string; objectKey: string; maxBytes: number }): Promise<Uint8Array>;
  deleteObject(input: { bucket: string; objectKey: string }): Promise<void>;
};

function contentDisposition(fileName?: string) {
  if (!fileName) return undefined;
  const sanitized = fileName.replace(/[\r\n"\\]/g, "_").slice(0, 180);
  return `attachment; filename*=UTF-8''${encodeURIComponent(sanitized)}`;
}

export class AwsSdkTimewebObjectStorageSigner implements TimewebObjectStorageSigner {
  readonly config: TimewebObjectStorageConfig;
  private readonly client: S3Client;

  constructor(config: TimewebObjectStorageConfig = readTimewebObjectStorageConfig()) {
    this.config = config;
    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      forcePathStyle: true,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    });
  }

  async signUpload(input: { bucket: string; objectKey: string; mimeType: string; expiresInSeconds: number }) {
    return getSignedUrl(this.client, new PutObjectCommand({ Bucket: input.bucket, Key: input.objectKey, ContentType: input.mimeType }), { expiresIn: input.expiresInSeconds });
  }

  async signDownload(input: { bucket: string; objectKey: string; fileName?: string; expiresInSeconds: number }) {
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: input.bucket, Key: input.objectKey, ResponseContentDisposition: contentDisposition(input.fileName) }), { expiresIn: input.expiresInSeconds });
  }

  async statObject(input: { bucket: string; objectKey: string }) {
    try {
      const result = await this.client.send(new HeadObjectCommand({ Bucket: input.bucket, Key: input.objectKey }));
      return { sizeBytes: BigInt(result.ContentLength ?? 0), mimeType: result.ContentType ?? null };
    } catch (error) {
      if (isAwsS3NotFoundError(error)) return null;
      throw error;
    }
  }

  async readObject(input: { bucket: string; objectKey: string; maxBytes: number }) {
    assertSafeObjectReadLimit(input.maxBytes);
    const result = await this.client.send(new GetObjectCommand({ Bucket: input.bucket, Key: input.objectKey }));
    return collectBoundedPrivateObjectBytes({
      body: result.Body as AsyncIterable<Uint8Array> | null | undefined,
      expectedBytes: result.ContentLength,
      maxBytes: input.maxBytes,
    });
  }

  async deleteObject(input: { bucket: string; objectKey: string }) {
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: input.bucket, Key: input.objectKey }));
    } catch (error) {
      if (isAwsS3NotFoundError(error)) return;
      throw error;
    }
  }
}

function assertSafeObjectKey(objectKey: string) {
  if (!objectKey || objectKey.length > 1500 || objectKey.startsWith("/") || objectKey.includes("..") || objectKey.includes("\\") || /[\r\n\0]/.test(objectKey)) {
    throw new Error(OBJECT_STORAGE_INVALID_KEY);
  }
}

function result(url: string, expiresInSeconds: number): SignedObjectUrl {
  return { url, expiresAt: new Date(Date.now() + expiresInSeconds * 1000) };
}

export class TimewebPrivateObjectStorage implements PrivateObjectStorage {
  readonly providerCode = TIMEWEB_OBJECT_STORAGE_PROVIDER;

  constructor(private readonly bucket: string, private readonly signer: TimewebObjectStorageSigner) {
    if (!bucket.trim()) throw new Error("OBJECT_STORAGE_INVALID_BUCKET");
  }

  async createUploadUrl(input: CreateUploadUrlInput) {
    assertSafeObjectKey(input.objectKey);
    assertSafeSignedUrlTtl(input.expiresInSeconds);
    return result(await this.signer.signUpload({ bucket: this.bucket, ...input }), input.expiresInSeconds);
  }

  async createDownloadUrl(input: CreateDownloadUrlInput) {
    assertSafeObjectKey(input.objectKey);
    assertSafeSignedUrlTtl(input.expiresInSeconds);
    return result(await this.signer.signDownload({ bucket: this.bucket, ...input }), input.expiresInSeconds);
  }

  async statObject(objectKey: string) {
    assertSafeObjectKey(objectKey);
    return this.signer.statObject({ bucket: this.bucket, objectKey });
  }

  async readObject(objectKey: string, maxBytes: number) {
    assertSafeObjectKey(objectKey);
    assertSafeObjectReadLimit(maxBytes);
    return this.signer.readObject({ bucket: this.bucket, objectKey, maxBytes });
  }

  async deleteObject(objectKey: string) {
    assertSafeObjectKey(objectKey);
    await this.signer.deleteObject({ bucket: this.bucket, objectKey });
  }
}
