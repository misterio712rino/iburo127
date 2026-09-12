import type { VercelBlobAuthConfig } from "@/server/files/vercel-blob-config";

export type VercelBlobSdkCredentialOptions =
  | {
      token: string;
      oidcToken?: never;
      storeId?: never;
    }
  | {
      token?: never;
      oidcToken: string;
      storeId: string;
    };

export function toVercelBlobSdkCredentialOptions(
  config: VercelBlobAuthConfig,
): VercelBlobSdkCredentialOptions {
  if (config.mode === "read-write-token") {
    return { token: config.token };
  }

  return {
    oidcToken: config.oidcToken,
    storeId: config.storeId,
  };
}
