import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

import { createVercelBlobNativeSignedUrlDependencies } from "../server/files/vercel-blob-native-signed-url";

function delegationToken(payload: Record<string, unknown>) {
  return `${Buffer.from(JSON.stringify(payload), "utf8").toString("base64url")}.test`;
}

const realFetch = globalThis.fetch;
const calls: Array<{ input: string; init?: RequestInit }> = [];
const signingKey = "foundation-signing-key";
const pathname = "cases/12700000-0000-4000-8000-000000000001/12700000-0000-4000-8000-000000000002/object.pdf";
const tokenPayload = {
  storeId: "teststore123",
  ownerId: "owner",
  pathname,
  operations: ["put"],
  validUntil: Date.now() + 60_000,
  maximumSizeInBytes: 1234,
  allowedContentTypes: ["application/pdf"],
};
const issuedToken = {
  delegationToken: delegationToken(tokenPayload),
  clientSigningToken: signingKey,
  validUntil: tokenPayload.validUntil,
};

globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  calls.push({ input: String(input), init });
  return new Response(JSON.stringify(issuedToken), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}) as typeof fetch;

try {
  const dependencies = createVercelBlobNativeSignedUrlDependencies();
  const token = await dependencies.issueSignedToken({
    token: "vercel_blob_rw_teststore123_secret",
    pathname,
    operations: ["put"],
    validUntil: tokenPayload.validUntil,
    allowedContentTypes: ["application/pdf"],
    maximumSizeInBytes: 1234,
  });

  assert.deepEqual(token, issuedToken);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.input, "https://vercel.com/api/blob/signed-token");
  assert.equal(calls[0]?.init?.method, "POST");
  const headers = new Headers(calls[0]?.init?.headers);
  assert.equal(headers.get("authorization"), "Bearer vercel_blob_rw_teststore123_secret");
  assert.equal(headers.get("x-vercel-blob-store-id"), "teststore123");
  assert.equal(headers.get("x-api-version"), "12");
  assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), {
    pathname,
    operations: ["put"],
    validUntil: tokenPayload.validUntil,
    allowedContentTypes: ["application/pdf"],
    maximumSizeInBytes: 1234,
  });

  const { presignedUrl } = await dependencies.presignUrl(token, {
    operation: "put",
    pathname,
    access: "private",
    validUntil: tokenPayload.validUntil,
    allowedContentTypes: ["application/pdf"],
    maximumSizeInBytes: 1234,
    addRandomSuffix: false,
    allowOverwrite: false,
  });
  const url = new URL(presignedUrl);
  assert.equal(url.origin, "https://vercel.com");
  assert.equal(url.pathname, "/api/blob/");
  assert.equal(url.searchParams.get("pathname"), pathname);
  assert.equal(url.searchParams.get("vercel-blob-allowed-content-types"), "application/pdf");
  assert.equal(url.searchParams.get("vercel-blob-maximum-size-in-bytes"), "1234");
  assert.equal(url.searchParams.get("vercel-blob-add-random-suffix"), "false");
  assert.equal(url.searchParams.get("vercel-blob-allow-overwrite"), "false");
  assert.equal(url.searchParams.get("vercel-blob-delegation"), issuedToken.delegationToken);

  const canonical = [
    "operation=put",
    `pathname=${pathname}`,
    "vercel-blob-add-random-suffix=false",
    "vercel-blob-allow-overwrite=false",
    "vercel-blob-allowed-content-types=application/pdf",
    "vercel-blob-maximum-size-in-bytes=1234",
  ].sort().join("\n");
  assert.equal(
    url.searchParams.get("vercel-blob-signature"),
    createHmac("sha256", signingKey).update(canonical, "utf8").digest("base64url"),
  );

  const getPayload = {
    ...tokenPayload,
    operations: ["get"],
    maximumSizeInBytes: undefined,
    allowedContentTypes: undefined,
  };
  const getToken = {
    delegationToken: delegationToken(getPayload),
    clientSigningToken: signingKey,
    validUntil: tokenPayload.validUntil,
  };
  const getResult = await dependencies.presignUrl(getToken, {
    operation: "get",
    pathname,
    access: "private",
    validUntil: tokenPayload.validUntil,
    useCache: false,
  });
  const getUrl = new URL(getResult.presignedUrl);
  assert.equal(getUrl.hostname, "teststore123.private.blob.vercel-storage.com");
  assert.equal(getUrl.searchParams.get("cache"), "0");
  assert.equal(getUrl.searchParams.get("vercel-blob-delegation"), getToken.delegationToken);

  calls.length = 0;
  await dependencies.issueSignedToken({
    oidcToken: "oidc-foundation-token",
    storeId: "store_teststore123",
    pathname,
    operations: ["head"],
    validUntil: Date.now() + 60_000,
  });
  const oidcHeaders = new Headers(calls[0]?.init?.headers);
  assert.equal(oidcHeaders.get("authorization"), "Bearer oidc-foundation-token");
  assert.equal(oidcHeaders.get("x-vercel-blob-store-id"), "teststore123");
} finally {
  globalThis.fetch = realFetch;
}

console.log("VERCEL_BLOB_NATIVE_SIGNED_URL_PASS");
