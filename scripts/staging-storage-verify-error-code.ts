export type StagingStorageVerifyErrorCode =
  | "TARGET_GUARD"
  | "AUTH_CONFIG"
  | "NETWORK_TIMEOUT"
  | "NETWORK_OR_RUNTIME"
  | "SIGNED_TOKEN_RESPONSE_TOO_LARGE"
  | "SIGNED_TOKEN_RESPONSE_INVALID"
  | "DELEGATION_INVALID"
  | "DELEGATION_SCOPE_MISMATCH"
  | "STORE_ID_INVALID"
  | "CREDENTIALS_MISSING"
  | "PRESIGN_CONTRACT"
  | "UNKNOWN"
  | `SIGNED_TOKEN_HTTP_${number}`;

const exactNativeCodes = new Map<string, StagingStorageVerifyErrorCode>([
  ["signed-token-response-too-large", "SIGNED_TOKEN_RESPONSE_TOO_LARGE"],
  ["invalid-signed-token-response", "SIGNED_TOKEN_RESPONSE_INVALID"],
  ["invalid-delegation-payload", "DELEGATION_INVALID"],
  ["delegation-scope-mismatch", "DELEGATION_SCOPE_MISMATCH"],
  ["invalid-store-id", "STORE_ID_INVALID"],
  ["missing-credentials", "CREDENTIALS_MISSING"],
]);

export function classifyStagingStorageVerifyError(error: unknown): StagingStorageVerifyErrorCode {
  const name = error instanceof Error ? error.name : "";
  const message = error instanceof Error ? error.message : "";

  if (name === "AbortError" || name === "TimeoutError") return "NETWORK_TIMEOUT";
  if (message.startsWith("STAGING_STORAGE_TARGET_GUARD:")) return "TARGET_GUARD";
  if (message.startsWith("VERCEL_BLOB_CONFIG_ERROR:")) return "AUTH_CONFIG";

  const native = /^VERCEL_BLOB_NATIVE_BINDING_ERROR:([a-z0-9-]+)$/.exec(message);
  if (native) {
    const reason = native[1];
    const http = /^signed-token-http-([45][0-9]{2})$/.exec(reason);
    if (http) return `SIGNED_TOKEN_HTTP_${http[1]}`;
    return exactNativeCodes.get(reason) ?? "UNKNOWN";
  }

  if (message.startsWith("STAGING_VERCEL_BLOB_VERIFY_ERROR:")) return "PRESIGN_CONTRACT";
  if (name === "TypeError") return "NETWORK_OR_RUNTIME";
  return "UNKNOWN";
}
