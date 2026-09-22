import assert from "node:assert/strict";
import test from "node:test";
import {
  readBoundedScannerJson, STAGING_SCANNER_RESPONSE_DENIED,
} from "../scripts/staging-scanner-bounded-json";

const denied = new RegExp(STAGING_SCANNER_RESPONSE_DENIED);

test("accepts a small JSON control response", async () => {
  const response = Response.json({ value: "fake-test-identity" });
  assert.deepEqual(await readBoundedScannerJson(response, 512), { value: "fake-test-identity" });
});

test("rejects oversized declared content length before parsing", async () => {
  const response = new Response("{}", { headers: { "content-length": "20000" } });
  await assert.rejects(readBoundedScannerJson(response, 1024), denied);
});

test("rejects oversized chunked content without a content length", async () => {
  const response = new Response("x".repeat(2048));
  await assert.rejects(readBoundedScannerJson(response, 1024), denied);
});
