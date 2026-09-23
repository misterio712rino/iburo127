import assert from "node:assert/strict";
import test from "node:test";

import { classifyStagingStorageVerifyError } from "../scripts/staging-storage-verify-error-code";

test("classifies staging storage verifier failures without exposing raw messages", () => {
  const cases: Array<[unknown, string]> = [
    [new Error("STAGING_STORAGE_TARGET_GUARD:missing secret-sentinel"), "TARGET_GUARD"],
    [new Error("VERCEL_BLOB_CONFIG_ERROR:missing secret-sentinel"), "AUTH_CONFIG"],
    [new Error("VERCEL_BLOB_NATIVE_BINDING_ERROR:signed-token-http-403"), "SIGNED_TOKEN_HTTP_403"],
    [new Error("VERCEL_BLOB_NATIVE_BINDING_ERROR:signed-token-http-503"), "SIGNED_TOKEN_HTTP_503"],
    [new Error("VERCEL_BLOB_NATIVE_BINDING_ERROR:signed-token-response-too-large"), "SIGNED_TOKEN_RESPONSE_TOO_LARGE"],
    [new Error("VERCEL_BLOB_NATIVE_BINDING_ERROR:invalid-signed-token-response"), "SIGNED_TOKEN_RESPONSE_INVALID"],
    [new Error("VERCEL_BLOB_NATIVE_BINDING_ERROR:invalid-delegation-payload"), "DELEGATION_INVALID"],
    [new Error("VERCEL_BLOB_NATIVE_BINDING_ERROR:delegation-scope-mismatch"), "DELEGATION_SCOPE_MISMATCH"],
    [new Error("VERCEL_BLOB_NATIVE_BINDING_ERROR:invalid-store-id"), "STORE_ID_INVALID"],
    [new Error("VERCEL_BLOB_NATIVE_BINDING_ERROR:missing-credentials"), "CREDENTIALS_MISSING"],
    [new Error("STAGING_VERCEL_BLOB_VERIFY_ERROR:presigned-url-pathname-mismatch"), "PRESIGN_CONTRACT"],
    [Object.assign(new Error("secret-sentinel"), { name: "AbortError" }), "NETWORK_TIMEOUT"],
    [new TypeError("secret-sentinel"), "NETWORK_OR_RUNTIME"],
    [new Error("secret-sentinel"), "UNKNOWN"],
    ["secret-sentinel", "UNKNOWN"],
  ];

  for (const [error, expected] of cases) {
    const code = classifyStagingStorageVerifyError(error);
    assert.equal(code, expected);
    assert.equal(code.includes("secret-sentinel"), false);
  }
});

test("does not reflect arbitrary native binding reasons", () => {
  assert.equal(
    classifyStagingStorageVerifyError(
      new Error("VERCEL_BLOB_NATIVE_BINDING_ERROR:secret-sentinel"),
    ),
    "UNKNOWN",
  );
});
