import "server-only";

import type { StoredObjectMetadata } from "@/server/files/object-storage-contract";
import type { VercelBlobSdkCredentialOptions } from "@/server/files/vercel-blob-driver-auth";
import type { VercelBlobStorageDriver } from "@/server/files/vercel-blob-object-storage";

export const VERCEL_BLOB_DRIVER_ERROR = "VERCEL_BLOB_DRIVER_ERROR";

const INTERNAL_OPERATION_TTL_SECONDS = 60;

type VercelBlobOperation = "get" | "head" | "put" | "delete";

type SignedToken = {
  delegationToken: string;
  clientSigningToken: string;
  validUntil: number;
};

type IssueSignedTokenInput = VercelBlobSdkCredentialOptions & {
  pathname: string;
  operations: VercelBlobOperation[];
  validUntil: number;
  allowedContentTypes?: string[];
  maximumSizeInBytes?: number;
};

type PresignUrlInput = {
  operation: VercelBlobOperation;
  pathname: string;
  access: "private";
  validUntil: number;
  useCache?: boolean;
  allowedContentTypes?: string[];
  maximumSizeInBytes?: number;
  addRandomSuffix?: boolean;
  allowOverwrite?: boolean;
};

type Awaitable<T> = T | Promise<T>;

export type VercelBlobSignedUrlDependencies = {
  issueSignedToken(input: IssueSignedTokenInput): Promise<SignedToken>;
  presignUrl(token: SignedToken, input: PresignUrlInput): Awaitable<{ presignedUrl: string }>;
  request(input: string, init?: RequestInit): Promise<Response>;
  now?: () => number;
};

function validUntil(now: () => number, expiresInSeconds: number) {
  return now() + expiresInSeconds * 1000;
}

async function signOperation(
  dependencies: VercelBlobSignedUrlDependencies,
  credentials: VercelBlobSdkCredentialOptions,
  input: {
    operation: VercelBlobOperation;
    pathname: string;
    expiresInSeconds: number;
    useCache?: boolean;
    allowedContentTypes?: string[];
    maximumSizeInBytes?: number;
    addRandomSuffix?: boolean;
    allowOverwrite?: boolean;
  },
) {
  const now = dependencies.now ?? Date.now;
  const expiresAt = validUntil(now, input.expiresInSeconds);
  const token = await dependencies.issueSignedToken({
    ...credentials,
    pathname: input.pathname,
    operations: [input.operation],
    validUntil: expiresAt,
    allowedContentTypes: input.allowedContentTypes,
    maximumSizeInBytes: input.maximumSizeInBytes,
  });
  const { presignedUrl } = await dependencies.presignUrl(token, {
    operation: input.operation,
    pathname: input.pathname,
    access: "private",
    validUntil: expiresAt,
    useCache: input.useCache,
    allowedContentTypes: input.allowedContentTypes,
    maximumSizeInBytes: input.maximumSizeInBytes,
    addRandomSuffix: input.addRandomSuffix,
    allowOverwrite: input.allowOverwrite,
  });
  if (!presignedUrl || !presignedUrl.startsWith("https://")) {
    throw new Error(`${VERCEL_BLOB_DRIVER_ERROR}:invalid-presigned-url`);
  }
  return presignedUrl;
}

function parseStoredObjectMetadata(response: Response): StoredObjectMetadata {
  const contentLength = response.headers.get("content-length")?.trim();
  if (!contentLength || !/^\d+$/.test(contentLength)) {
    throw new Error(`${VERCEL_BLOB_DRIVER_ERROR}:invalid-content-length`);
  }
  const contentType = response.headers.get("content-type")?.trim() || null;
  return {
    sizeBytes: BigInt(contentLength),
    mimeType: contentType,
  };
}

async function requireSuccessfulResponse(
  response: Response,
  operation: "head" | "delete",
) {
  if (!response.ok) {
    throw new Error(`${VERCEL_BLOB_DRIVER_ERROR}:${operation}:${response.status}`);
  }
}

/**
 * Creates the transport driver used by VercelBlobPrivateObjectStorage while
 * keeping @vercel/blob imports isolated in a future concrete SDK binding.
 */
export function createVercelBlobSignedUrlDriver(
  dependencies: VercelBlobSignedUrlDependencies,
  credentials: VercelBlobSdkCredentialOptions,
): VercelBlobStorageDriver {
  return {
    async createPrivateUploadUrl(input) {
      return signOperation(dependencies, credentials, {
        operation: "put",
        pathname: input.pathname,
        expiresInSeconds: input.expiresInSeconds,
        allowedContentTypes: [input.mimeType],
        maximumSizeInBytes: input.maximumSizeInBytes,
        addRandomSuffix: false,
        allowOverwrite: input.allowOverwrite === true,
      });
    },

    async createPrivateDownloadUrl(input) {
      return signOperation(dependencies, credentials, {
        operation: "get",
        pathname: input.pathname,
        expiresInSeconds: input.expiresInSeconds,
        useCache: false,
      });
    },

    async statPrivateBlob(pathname) {
      const url = await signOperation(dependencies, credentials, {
        operation: "head",
        pathname,
        expiresInSeconds: INTERNAL_OPERATION_TTL_SECONDS,
      });
      const response = await dependencies.request(url, { method: "HEAD" });
      if (response.status === 404) return null;
      await requireSuccessfulResponse(response, "head");
      return parseStoredObjectMetadata(response);
    },

    async deletePrivateBlob(pathname) {
      const url = await signOperation(dependencies, credentials, {
        operation: "delete",
        pathname,
        expiresInSeconds: INTERNAL_OPERATION_TTL_SECONDS,
      });
      const response = await dependencies.request(url, { method: "DELETE" });
      if (response.status === 404) return;
      await requireSuccessfulResponse(response, "delete");
    },
  };
}
