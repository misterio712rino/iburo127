import "server-only";

import {
  assertSafeObjectReadLimit,
  collectBoundedPrivateObjectBytes,
  OBJECT_STORAGE_READ_TOO_LARGE,
  OBJECT_STORAGE_READ_UNAVAILABLE,
  type StoredObjectMetadata,
} from "@/server/files/object-storage-contract";
import type { VercelBlobSdkCredentialOptions } from "@/server/files/vercel-blob-driver-auth";
import { isVercelBlobDeleteSuccessStatus } from "@/server/files/vercel-blob-delete-semantics";
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
  ifMatch?: string;
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
  ifMatch?: string;
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

    async readPrivateBlob(pathname, maxBytes) {
      assertSafeObjectReadLimit(maxBytes);
      const url = await signOperation(dependencies, credentials, {
        operation: "get",
        pathname,
        expiresInSeconds: INTERNAL_OPERATION_TTL_SECONDS,
        useCache: false,
      });
      const parsedUrl = new URL(url);
      if (
        parsedUrl.protocol !== "https:" ||
        !parsedUrl.hostname.endsWith(".private.blob.vercel-storage.com")
      ) {
        throw new Error(VERCEL_BLOB_DRIVER_ERROR + ":unsafe-private-read-url");
      }
      const response = await dependencies.request(url, {
        method: "GET",
        redirect: "error",
        cache: "no-store",
      });
      if (response.status !== 200) {
        throw new Error(VERCEL_BLOB_DRIVER_ERROR + ":get:" + response.status);
      }
      const contentLength = response.headers.get("content-length")?.trim();
      if (!contentLength || !/^\d+$/.test(contentLength)) {
        throw new Error(OBJECT_STORAGE_READ_UNAVAILABLE);
      }
      const expectedBytes = Number(contentLength);
      if (!Number.isSafeInteger(expectedBytes) || expectedBytes < 1) {
        throw new Error(OBJECT_STORAGE_READ_UNAVAILABLE);
      }
      if (expectedBytes > maxBytes) throw new Error(OBJECT_STORAGE_READ_TOO_LARGE);
      return collectBoundedPrivateObjectBytes({
        body: response.body as unknown as AsyncIterable<Uint8Array> | null,
        expectedBytes,
        maxBytes,
      });
    },

    async deletePrivateBlob(pathname) {
      const url = await signOperation(dependencies, credentials, {
        operation: "delete",
        pathname,
        expiresInSeconds: INTERNAL_OPERATION_TTL_SECONDS,
      });
      const response = await dependencies.request(url, { method: "DELETE" });
      if (isVercelBlobDeleteSuccessStatus(response.status)) return;
      await requireSuccessfulResponse(response, "delete");
    },
  };
}
