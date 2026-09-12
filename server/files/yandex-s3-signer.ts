import "server-only";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { readYandexObjectStorageConfig } from "@/server/config/production";
import { isAwsS3NotFoundError } from "@/server/files/aws-s3-object-storage-errors";
import type { YandexObjectStorageSigner } from "@/server/files/yandex-object-storage";

function contentDisposition(fileName?: string) {
  if (!fileName) return undefined;
  const sanitized = fileName.replace(/[\r\n"\\]/g, "_").slice(0, 180);
  return `attachment; filename*=UTF-8''${encodeURIComponent(sanitized)}`;
}

export class AwsSdkYandexObjectStorageSigner implements YandexObjectStorageSigner {
  private readonly client: S3Client;

  constructor() {
    const config = readYandexObjectStorageConfig();
    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
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
      return {
        sizeBytes: BigInt(result.ContentLength ?? 0),
        mimeType: result.ContentType ?? null,
      };
    } catch (error) {
      if (isAwsS3NotFoundError(error)) return null;
      throw error;
    }
  }

  async deleteObject(input: { bucket: string; objectKey: string }) {
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: input.bucket, Key: input.objectKey }));
    } catch (error) {
      // S3-compatible DELETE is idempotent for an absent key. Some compatible
      // providers may surface NOT_FOUND instead of a successful empty delete,
      // so normalize that outcome to success. Unknown/network failures still
      // propagate and are retried by the durable deletion processor.
      if (isAwsS3NotFoundError(error)) return;
      throw error;
    }
  }
}
