import "server-only";

import type { VercelBlobSdkCredentialOptions } from "@/server/files/vercel-blob-driver-auth";
import type {
  VercelBlobSignedUrlDependencies,
} from "@/server/files/vercel-blob-signed-url-driver";

export const VERCEL_BLOB_NATIVE_BINDING_ERROR = "VERCEL_BLOB_NATIVE_BINDING_ERROR";

const BLOB_API_URL = "https://vercel.com/api/blob";
const BLOB_API_VERSION = "12";
const PRIVATE_BLOB_HOST_SUFFIX = ".private.blob.vercel-storage.com";
const ISSUE_TIMEOUT_MS = 15_000;

const PRESIGN_QUERY_KEYS = [
  "vercel-blob-add-random-suffix",
  "vercel-blob-allow-overwrite",
  "vercel-blob-allowed-content-types",
  "vercel-blob-cache-control-max-age",
  "vercel-blob-callback-token-payload",
  "vercel-blob-callback-url",
  "vercel-blob-if-match",
  "vercel-blob-maximum-size-in-bytes",
  "vercel-blob-valid-until",
] as const;

type DelegationOperation = "get" | "head" | "put" | "delete";

type DelegationPayload = {
  storeId: string;
  pathname: string;
  operations: string[];
  validUntil: number;
  maximumSizeInBytes?: number;
  allowedContentTypes?: string[];
};

type IssuedSignedToken = {
  delegationToken: string;
  clientSigningToken: string;
  validUntil: number;
};

function fail(reason: string): never {
  throw new Error(`${VERCEL_BLOB_NATIVE_BINDING_ERROR}:${reason}`);
}

function normalizeStoreId(value: string) {
  const trimmed = value.trim();
  const bare = trimmed.startsWith("store_") ? trimmed.slice("store_".length) : trimmed;
  if (!/^[A-Za-z0-9_-]{3,128}$/.test(bare)) fail("invalid-store-id");
  return bare;
}

function parseStoreIdFromReadWriteToken(token: string) {
  const parts = token.split("_");
  return normalizeStoreId(parts[3] ?? "");
}

function resolveAuth(input: VercelBlobSdkCredentialOptions) {
  if ("token" in input && input.token) {
    return { bearerToken: input.token, storeId: parseStoreIdFromReadWriteToken(input.token) };
  }
  if ("oidcToken" in input && input.oidcToken && input.storeId) {
    return { bearerToken: input.oidcToken, storeId: normalizeStoreId(input.storeId) };
  }
  return fail("missing-credentials");
}

function decodeDelegationPayload(token: string): DelegationPayload {
  const segment = token.split(".", 1)[0];
  if (!segment) fail("invalid-delegation-token");
  try {
    const normalized = segment.replace(/-/g, "+").replace(/_/g, "/");
    const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
    const json = Buffer.from(`${normalized}${padding}`, "base64").toString("utf8");
    const parsed = JSON.parse(json) as Partial<DelegationPayload>;
    if (
      typeof parsed.storeId !== "string" ||
      typeof parsed.pathname !== "string" ||
      !Array.isArray(parsed.operations) ||
      typeof parsed.validUntil !== "number"
    ) {
      return fail("invalid-delegation-payload");
    }
    return parsed as DelegationPayload;
  } catch {
    return fail("invalid-delegation-payload");
  }
}

function utf8Compare(a: string, b: string) {
  return Buffer.compare(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
}

function canonicalString(
  pathname: string,
  entries: Array<[string, string]>,
  operation: DelegationOperation,
) {
  const lines = [`operation=${operation}`, `pathname=${pathname}`];
  for (const key of PRESIGN_QUERY_KEYS) {
    const value = entries.find(([entryKey]) => entryKey === key)?.[1];
    if (value) lines.push(`${key}=${value}`);
  }
  return lines.sort(utf8Compare).join("\n");
}

async function hmacSha256Base64Url(key: string, data: string) {
  const cryptoKey = await globalThis.crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await globalThis.crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    new TextEncoder().encode(data),
  );
  return Buffer.from(signature).toString("base64url");
}

function buildConstraintEntries(
  delegation: DelegationPayload,
  input: {
    operation: DelegationOperation;
    validUntil: number;
    allowedContentTypes?: string[];
    maximumSizeInBytes?: number;
    addRandomSuffix?: boolean;
    allowOverwrite?: boolean;
  },
) {
  const now = Date.now();
  const resolvedUntil = Math.min(Math.trunc(input.validUntil), Math.trunc(delegation.validUntil));
  if (!Number.isFinite(resolvedUntil) || resolvedUntil <= now) fail("expired-presign");

  const entries: Array<[string, string]> = [];
  if (resolvedUntil < Math.trunc(delegation.validUntil)) {
    entries.push(["vercel-blob-valid-until", String(resolvedUntil)]);
  }
  if (input.operation !== "put") return entries;

  if (input.allowedContentTypes !== undefined) {
    const allowed = [...input.allowedContentTypes].sort(utf8Compare);
    if (delegation.allowedContentTypes?.length) {
      for (const contentType of allowed) {
        if (!delegation.allowedContentTypes.includes(contentType)) fail("content-type-outside-delegation");
      }
    }
    entries.push(["vercel-blob-allowed-content-types", allowed.join(",")]);
  }
  if (input.maximumSizeInBytes !== undefined) {
    if (
      !Number.isSafeInteger(input.maximumSizeInBytes) ||
      input.maximumSizeInBytes <= 0 ||
      (delegation.maximumSizeInBytes !== undefined &&
        input.maximumSizeInBytes > delegation.maximumSizeInBytes)
    ) {
      fail("size-outside-delegation");
    }
    entries.push(["vercel-blob-maximum-size-in-bytes", String(input.maximumSizeInBytes)]);
  }
  if (input.addRandomSuffix !== undefined) {
    entries.push(["vercel-blob-add-random-suffix", input.addRandomSuffix ? "true" : "false"]);
  }
  if (input.allowOverwrite !== undefined) {
    entries.push(["vercel-blob-allow-overwrite", input.allowOverwrite ? "true" : "false"]);
  }
  return entries;
}

function addSignedParams(
  url: URL,
  token: IssuedSignedToken,
  entries: Array<[string, string]>,
  signature: string,
) {
  for (const [key, value] of entries) url.searchParams.set(key, value);
  url.searchParams.set("vercel-blob-delegation", token.delegationToken);
  url.searchParams.set("vercel-blob-signature", signature);
  return url.toString();
}

async function nativeIssueSignedToken(
  input: Parameters<VercelBlobSignedUrlDependencies["issueSignedToken"]>[0],
) {
  const auth = resolveAuth(input);
  const body = {
    pathname: input.pathname,
    operations: [...new Set(input.operations)],
    validUntil: input.validUntil,
    ...(input.allowedContentTypes === undefined
      ? {}
      : { allowedContentTypes: input.allowedContentTypes }),
    ...(input.maximumSizeInBytes === undefined
      ? {}
      : { maximumSizeInBytes: input.maximumSizeInBytes }),
  };
  const response = await fetch(`${BLOB_API_URL}/signed-token`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${auth.bearerToken}`,
      "content-type": "application/json",
      "x-api-version": BLOB_API_VERSION,
      "x-vercel-blob-store-id": auth.storeId,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(ISSUE_TIMEOUT_MS),
    cache: "no-store",
  });
  if (!response.ok) fail(`signed-token-http-${response.status}`);
  const token = (await response.json()) as Partial<IssuedSignedToken>;
  if (
    typeof token.delegationToken !== "string" ||
    !token.delegationToken ||
    typeof token.clientSigningToken !== "string" ||
    !token.clientSigningToken ||
    typeof token.validUntil !== "number" ||
    !Number.isFinite(token.validUntil)
  ) {
    return fail("invalid-signed-token-response");
  }
  return token as IssuedSignedToken;
}

async function nativePresignUrl(
  token: IssuedSignedToken,
  input: Parameters<VercelBlobSignedUrlDependencies["presignUrl"]>[1],
) {
  const delegation = decodeDelegationPayload(token.delegationToken);
  if (delegation.pathname !== "*" && delegation.pathname !== input.pathname) {
    fail("pathname-outside-delegation");
  }
  if (!delegation.operations.includes(input.operation)) fail("operation-outside-delegation");
  if (Date.now() > delegation.validUntil) fail("delegation-expired");

  const entries = buildConstraintEntries(delegation, input);
  const signature = await hmacSha256Base64Url(
    token.clientSigningToken,
    canonicalString(input.pathname, entries, input.operation),
  );
  const storeId = normalizeStoreId(delegation.storeId);

  if (input.operation === "get" || input.operation === "head") {
    const url = new URL(`https://${storeId}${PRIVATE_BLOB_HOST_SUFFIX}/${input.pathname}`);
    if (input.operation === "get" && input.useCache === false) {
      url.searchParams.set("cache", "0");
    }
    return { presignedUrl: addSignedParams(url, token, entries, signature) };
  }

  const url = new URL(`${BLOB_API_URL}/`);
  url.searchParams.set("pathname", input.pathname);
  return { presignedUrl: addSignedParams(url, token, entries, signature) };
}

/**
 * Launch bridge matching the signed-token/presign contract from the exact
 * @vercel/blob@2.8.0 upstream tag. Uses only Node 24 native fetch/WebCrypto.
 * This keeps the runtime dependency-free until the audited SDK lockfile can be
 * materialized through normal package-manager tooling.
 */
export function createVercelBlobNativeSignedUrlDependencies(): VercelBlobSignedUrlDependencies {
  return {
    issueSignedToken: nativeIssueSignedToken,
    presignUrl: nativePresignUrl,
    request: (input, init) =>
      fetch(input, {
        ...init,
        cache: "no-store",
        signal: AbortSignal.timeout(ISSUE_TIMEOUT_MS),
      }),
  };
}
