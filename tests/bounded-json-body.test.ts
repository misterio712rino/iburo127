import assert from "node:assert/strict";
import { readJsonBodyWithByteLimit } from "../server/http/bounded-json-core";

const encoder = new TextEncoder();

function jsonRequest(body: string, headers?: HeadersInit): Request {
  return new Request("https://platform.example.test/api/platform/test", {
    method: "POST",
    headers,
    body,
  });
}

const validPayload = JSON.stringify({ value: "ok" });
const validBytes = encoder.encode(validPayload).byteLength;

const valid = await readJsonBodyWithByteLimit(
  jsonRequest(validPayload),
  validBytes + 8,
);
assert.deepEqual(valid, { status: "ok", value: { value: "ok" } });

const exactLimit = await readJsonBodyWithByteLimit(
  jsonRequest(validPayload),
  validBytes,
);
assert.equal(exactLimit.status, "ok");

const oneByteTooSmall = await readJsonBodyWithByteLimit(
  jsonRequest(validPayload),
  validBytes - 1,
);
assert.deepEqual(oneByteTooSmall, { status: "too_large" });

const noContentLengthRequest = jsonRequest(validPayload);
assert.equal(noContentLengthRequest.headers.get("content-length"), null);
const noContentLengthOversize = await readJsonBodyWithByteLimit(
  noContentLengthRequest,
  validBytes - 1,
);
assert.deepEqual(noContentLengthOversize, { status: "too_large" });

const forgedLowContentLength = await readJsonBodyWithByteLimit(
  jsonRequest(validPayload, { "content-length": "1" }),
  validBytes - 1,
);
assert.deepEqual(forgedLowContentLength, { status: "too_large" });

const declaredOversize = await readJsonBodyWithByteLimit(
  jsonRequest("{}", { "content-length": "999" }),
  16,
);
assert.deepEqual(declaredOversize, { status: "too_large" });

const malformed = await readJsonBodyWithByteLimit(
  jsonRequest('{"value":'),
  1024,
);
assert.deepEqual(malformed, { status: "ok", value: undefined });

const empty = await readJsonBodyWithByteLimit(
  new Request("https://platform.example.test/api/platform/test", { method: "POST" }),
  1024,
);
assert.deepEqual(empty, { status: "ok", value: undefined });

const multibytePayload = JSON.stringify({ value: "Привет" });
const multibyteBytes = encoder.encode(multibytePayload).byteLength;
assert.ok(multibyteBytes > multibytePayload.length, "test requires multibyte UTF-8 input");
const multibyteOversize = await readJsonBodyWithByteLimit(
  jsonRequest(multibytePayload),
  multibyteBytes - 1,
);
assert.deepEqual(multibyteOversize, { status: "too_large" });

const chunkOne = encoder.encode('{"value":"');
const chunkTwo = encoder.encode('chunked"}');
const chunkedStream = new ReadableStream<Uint8Array>({
  start(controller) {
    controller.enqueue(chunkOne);
    controller.enqueue(chunkTwo);
    controller.close();
  },
});
const chunkedRequest = new Request(
  "https://platform.example.test/api/platform/test",
  {
    method: "POST",
    body: chunkedStream,
    duplex: "half",
  } as RequestInit & { duplex: "half" },
);
const chunkedTotal = chunkOne.byteLength + chunkTwo.byteLength;
const chunkedOversize = await readJsonBodyWithByteLimit(
  chunkedRequest,
  chunkedTotal - 1,
);
assert.deepEqual(chunkedOversize, { status: "too_large" });

await assert.rejects(
  () => readJsonBodyWithByteLimit(jsonRequest("{}"), 0),
  /maxBytes must be a positive safe integer/,
);

console.log("BOUNDED_JSON_BODY_TEST_PASS");
