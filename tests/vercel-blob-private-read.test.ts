import assert from "node:assert/strict";
import { createVercelBlobSignedUrlDriver } from "@/server/files/vercel-blob-signed-url-driver";

const privateUrl = "https://teststore123.private.blob.vercel-storage.com/cases/example";
let requestedUrl = "";
let requestedInit: RequestInit | undefined;
const responseBody = new Uint8Array([1, 2, 3]);
let responseSize = 3;
let signedUrl = privateUrl;
const driver = createVercelBlobSignedUrlDriver(
  {
    async issueSignedToken(input) {
      assert.deepEqual(input.operations, ["get"]);
      return {
        delegationToken: "delegation",
        clientSigningToken: "signing",
        validUntil: input.validUntil,
      };
    },
    presignUrl(_token, input) {
      assert.equal(input.operation, "get");
      assert.equal(input.access, "private");
      assert.equal(input.useCache, false);
      return { presignedUrl: signedUrl };
    },
    async request(url, init) {
      requestedUrl = url;
      requestedInit = init;
      return new Response(responseBody, {
        status: 200,
        headers: { "content-length": String(responseSize) },
      });
    },
  },
  { token: "vercel_blob_rw_teststore123_secret" },
);

assert.deepEqual(await driver.readPrivateBlob("cases/example", 10), responseBody);
assert.equal(requestedUrl, privateUrl);
assert.equal(requestedInit?.method, "GET");
assert.equal(requestedInit?.redirect, "error");
assert.equal(requestedInit?.cache, "no-store");

responseSize = 11;
await assert.rejects(driver.readPrivateBlob("cases/example", 10), /OBJECT_STORAGE_READ_TOO_LARGE/);

signedUrl = "https://example.invalid/private";
requestedUrl = "";
await assert.rejects(driver.readPrivateBlob("cases/example", 10), /unsafe-private-read-url/);
assert.equal(requestedUrl, "");

console.log("Vercel Blob private bounded read tests: PASS");
