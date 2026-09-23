import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

import { isVercelBlobDeleteSuccessStatus } from "../server/files/vercel-blob-delete-semantics";
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
  const requested = JSON.parse(String(init?.body)) as { operations: string[] };
  const responseToken = requested.operations.includes("head")
    ? { ...issuedToken, delegationToken: delegationToken({ ...tokenPayload, operations: ["head"] }) }
    : issuedToken;
  return new Response(JSON.stringify(responseToken), {
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
  assert.equal(calls[0]?.init?.redirect, "error");
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

  const originalTokenFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async (_input, init) => {
      if (init?.redirect !== "error") return Response.json(issuedToken);
      return new Response(null, {
        status: 302, headers: { location: "https://example.invalid/collect" },
      });
    }) as typeof fetch;
    await assert.rejects(dependencies.issueSignedToken({
      token: "vercel_blob_rw_teststore123_secret", pathname,
      operations: ["put"], validUntil: tokenPayload.validUntil,
    }), /signed-token-http-302/);
  } finally {
    globalThis.fetch = originalTokenFetch;
  }

  const boundedResponseFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async () => new Response("{}", {
      status: 200,
      headers: {
        "content-type": "application/json",
        "content-length": "20000",
      },
    })) as typeof fetch;
    await assert.rejects(dependencies.issueSignedToken({
      token: "vercel_blob_rw_teststore123_secret", pathname,
      operations: ["put"], validUntil: tokenPayload.validUntil,
    }), /signed-token-response-too-large/);

    const oversizedStream = new Uint8Array(17_000).fill(0x78);
    globalThis.fetch = (async () => new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(oversizedStream);
          controller.close();
        },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    )) as typeof fetch;
    await assert.rejects(dependencies.issueSignedToken({
      token: "vercel_blob_rw_teststore123_secret", pathname,
      operations: ["put"], validUntil: tokenPayload.validUntil,
    }), /signed-token-response-too-large/);

    globalThis.fetch = (async () => new Response("null", {
      status: 200,
      headers: { "content-type": "application/json" },
    })) as typeof fetch;
    await assert.rejects(dependencies.issueSignedToken({
      token: "vercel_blob_rw_teststore123_secret", pathname,
      operations: ["put"], validUntil: tokenPayload.validUntil,
    }), /invalid-signed-token-response/);
  } finally {
    globalThis.fetch = boundedResponseFetch;
  }

  // A successfully signed URL must never target a different store, a wildcard
  // pathname, an extra operation, or a longer-lived grant than requested.
  const baselineFetch = globalThis.fetch;
  for (const unsafeGrant of [
    { storeId: "unrelatedstore" },
    { pathname: "*" },
    { operations: ["put", "delete"] },
    { validUntil: tokenPayload.validUntil + 60_000 },
  ]) {
    globalThis.fetch = (async () => Response.json({
      ...issuedToken,
      delegationToken: delegationToken({ ...tokenPayload, ...unsafeGrant }),
    })) as typeof fetch;
    await assert.rejects(dependencies.issueSignedToken({
      token: "vercel_blob_rw_teststore123_secret", pathname,
      operations: ["put"], validUntil: tokenPayload.validUntil,
    }), /delegation-scope-mismatch/);
  }
  globalThis.fetch = baselineFetch;
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

  const deletePayload = { ...getPayload, operations: ["delete"] };
  const deleteToken = { ...getToken, delegationToken: delegationToken(deletePayload) };
  const etag = '"1234567890abcdef1234567890abcdef"';
  const { presignedUrl: conditionalUrl } = await dependencies.presignUrl(deleteToken, {
    operation: "delete", pathname, access: "private",
    validUntil: tokenPayload.validUntil, ifMatch: etag,
  });
  const conditional = new URL(conditionalUrl);
  assert.equal(conditional.searchParams.get("vercel-blob-if-match"), etag);
  const deleteCanonical = ["operation=delete", `pathname=${pathname}`, `vercel-blob-if-match=${etag}`].sort().join("\n");
  assert.equal(conditional.searchParams.get("vercel-blob-signature"),
    createHmac("sha256", signingKey).update(deleteCanonical, "utf8").digest("base64url"));
  await assert.rejects(async () => dependencies.presignUrl(deleteToken, {
    operation: "delete", pathname, access: "private", validUntil: tokenPayload.validUntil,
    ifMatch: "bad\r\netag",
  }), /invalid-conditional-etag/);
  await assert.rejects(async () => dependencies.presignUrl(getToken, {
    operation: "get", pathname, access: "private", validUntil: tokenPayload.validUntil,
    ifMatch: etag,
  }), /invalid-conditional-etag/);
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

  assert.equal(isVercelBlobDeleteSuccessStatus(204), true);
  assert.equal(isVercelBlobDeleteSuccessStatus(404), true);
  assert.equal(isVercelBlobDeleteSuccessStatus(503), false);
} finally {
  globalThis.fetch = realFetch;
}

console.log("VERCEL_BLOB_NATIVE_SIGNED_URL_PASS");
