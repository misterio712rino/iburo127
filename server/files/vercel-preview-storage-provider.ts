import { VERCEL_STAGING_BRANCH } from "@/server/config/vercel-preview-boundary";
import {
  VERCEL_BLOB_STORAGE_PROVIDER,
  type PrivateObjectStorageProvider,
} from "@/server/files/object-storage-provider";

export type RuntimeStorageProviderEnvironment = Readonly<Record<string, string | undefined>>;

export function inferStagingVercelBlobProvider(
  env: RuntimeStorageProviderEnvironment = process.env,
): PrivateObjectStorageProvider | undefined {
  if (env.IB_OBJECT_STORAGE_PROVIDER?.trim()) return undefined;

  const token = env.BLOB_READ_WRITE_TOKEN?.trim();
  const exactStagingPreview =
    env.VERCEL_ENV?.trim() === "preview" &&
    env.VERCEL_GIT_COMMIT_REF?.trim() === VERCEL_STAGING_BRANCH &&
    env.IB_RUNTIME_TARGET?.trim() === "staging";

  if (exactStagingPreview && token && !/[\r\n\0]/.test(token)) {
    return VERCEL_BLOB_STORAGE_PROVIDER;
  }

  return undefined;
}
