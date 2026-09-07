import { toVercelBlobSdkCredentialOptions } from "@/server/files/vercel-blob-driver-auth";
import { createVercelBlobNativeSignedUrlDependencies } from "@/server/files/vercel-blob-native-signed-url";
import type { VercelBlobStagingStorageTarget } from "./staging-storage-target-guard";

export const STAGING_VERCEL_BLOB_VERIFY_ERROR = "STAGING_VERCEL_BLOB_VERIFY_ERROR";

const VERIFY_TTL_MS = 60_000;
const PRIVATE_BLOB_HOST_SUFFIX = ".private.blob.vercel-storage.com";

export type StagingVercelBlobVerification = {
  provider: "vercel-blob";
  signedTokenIssued: true;
  privateHostVerified: true;
  networkAccessed: true;
  valuesPrinted: false;
  objectEnumerationContentOperations: 0;
};

function fail(reason: string): never {
  throw new Error(`${STAGING_VERCEL_BLOB_VERIFY_ERROR}:${reason}`);
}

function fixturePath(commitSha: string) {
  return `_iburo/security-fixtures/storage-verifier/${commitSha}.probe`;
}

export async function verifyVercelBlobStagingAccess(
  target: VercelBlobStagingStorageTarget,
): Promise<StagingVercelBlobVerification> {
  const dependencies = createVercelBlobNativeSignedUrlDependencies();
  const credentials = toVercelBlobSdkCredentialOptions(target.auth);
  const pathname = fixturePath(target.commitSha);
  const validUntil = Date.now() + VERIFY_TTL_MS;

  const token = await dependencies.issueSignedToken({
    ...credentials,
    pathname,
    operations: ["head"],
    validUntil,
  });

  const { presignedUrl } = await dependencies.presignUrl(token, {
    operation: "head",
    pathname,
    access: "private",
    validUntil,
  });

  let parsed: URL;
  try {
    parsed = new URL(presignedUrl);
  } catch {
    fail("invalid-presigned-url");
  }

  if (parsed.protocol !== "https:") fail("presigned-url-must-use-https");
  if (!parsed.hostname.endsWith(PRIVATE_BLOB_HOST_SUFFIX)) {
    fail("presigned-url-is-not-private-blob-host");
  }
  if (decodeURIComponent(parsed.pathname) !== `/${pathname}`) {
    fail("presigned-url-pathname-mismatch");
  }
  if (
    !parsed.searchParams.get("vercel-blob-delegation") ||
    !parsed.searchParams.get("vercel-blob-signature")
  ) {
    fail("presigned-url-missing-private-signature");
  }

  return {
    provider: "vercel-blob",
    signedTokenIssued: true,
    privateHostVerified: true,
    networkAccessed: true,
    valuesPrinted: false,
    objectEnumerationContentOperations: 0,
  };
}
