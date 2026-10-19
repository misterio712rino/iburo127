import assert from "node:assert/strict";
import {
  DOCUMENT_PROCESSOR_MAX_UPLOAD_BYTES,
  DocumentProcessorClient,
  readDocumentProcessorConfig,
} from "../server/files/document-processor-client";

const token = "processor-test-token-at-least-thirty-two-characters";
const config = readDocumentProcessorConfig({
  IB_DOCUMENT_PROCESSOR_URL: "http://document-processor:8080/",
  IB_DOCUMENT_PROCESSOR_TOKEN: token,
});
assert.equal(config.baseUrl, "http://document-processor:8080");
assert.throws(() => readDocumentProcessorConfig({
  IB_DOCUMENT_PROCESSOR_URL: "https://user:pass@example.com/",
  IB_DOCUMENT_PROCESSOR_TOKEN: token,
}), /DOCUMENT_PROCESSOR_INVALID_CONFIG:URL/);
assert.throws(() => readDocumentProcessorConfig({
  IB_DOCUMENT_PROCESSOR_URL: "http://example.com/",
  IB_DOCUMENT_PROCESSOR_TOKEN: token,
}), /DOCUMENT_PROCESSOR_INVALID_CONFIG:URL/);

let call: { url: string; init?: RequestInit } | undefined;
const client = new DocumentProcessorClient(config, (async (input, init) => {
  call = { url: String(input), init };
  return Response.json(
    { ok: true, data: { text: "Распознанный текст", pages: 2 } },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}) as typeof fetch);
const result = await client.extract({ bytes: new Uint8Array([1, 2, 3]), mimeType: "application/pdf" });
assert.deepEqual(result, { text: "Распознанный текст", pages: 2 });
assert.equal(call?.url, "http://document-processor:8080/v1/extract");
assert.equal(call?.init?.method, "POST");
assert.equal(call?.init?.cache, "no-store");
assert.equal(call?.init?.redirect, "error");
const headers = new Headers(call?.init?.headers);
assert.equal(headers.get("authorization"), `Bearer ${token}`);
assert.equal(headers.get("content-type"), "application/pdf");
assert.equal(headers.get("content-length"), "3");

const rejectingClient = new DocumentProcessorClient(config, (async () =>
  Response.json({ ok: false, error: { code: "UNSUPPORTED_MEDIA_TYPE" } }, { status: 415 })
) as typeof fetch);
await assert.rejects(
  rejectingClient.extract({ bytes: new Uint8Array([1]), mimeType: "image/jpeg" }),
  /DOCUMENT_PROCESSOR_REQUEST_FAILED:UNSUPPORTED_MEDIA_TYPE/,
);

const oversizedClient = new DocumentProcessorClient(config, (async () =>
  new Response(new Uint8Array(DOCUMENT_PROCESSOR_MAX_UPLOAD_BYTES + 1), {
    status: 200,
    headers: { "content-type": "application/json" },
  })
) as typeof fetch);
await assert.rejects(
  oversizedClient.extract({ bytes: new Uint8Array([1]), mimeType: "image/jpeg" }),
  /RESPONSE_TOO_LARGE/,
);

await assert.rejects(
  client.extract({ bytes: new Uint8Array(), mimeType: "image/jpeg" }),
  /INVALID_INPUT/,
);

console.log("Document processor client tests: PASS");
