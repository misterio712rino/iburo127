import assert from "node:assert/strict";
import test from "node:test";
import { verifyAuthorizedStagingScannerHealth, STAGING_SCANNER_HEALTH_DENIED } from "../scripts/staging-scanner-health-preflight";

const origin = "https://scanner-v2-staging.iburo127.online";
const secret = "staging-health-test-secret-" + "x".repeat(32);
const denied = new RegExp(STAGING_SCANNER_HEALTH_DENIED);
const success = () => Response.json({ status: "ok" });

test("authorizes exact staging health without redirects before fixture mutation", async () => {
  let requests = 0;
  const fake = (async (url: RequestInfo | URL, init?: RequestInit) => {
    requests++;
    assert.equal(String(url), `${origin}/health`);
    assert.equal(init?.method, "GET");
    assert.equal(init?.redirect, "error");
    assert.equal(init?.cache, "no-store");
    assert.equal(new Headers(init?.headers).get("authorization"), `Bearer ${secret}`);
    return success();
  }) as typeof fetch;
  await verifyAuthorizedStagingScannerHealth(origin, secret, fake);
  assert.equal(requests, 1);
});

test("rejects any alternate origin or weak credential before network", async () => {
  const fake = (async () => { throw new Error("network should not run"); }) as typeof fetch;
  await assert.rejects(verifyAuthorizedStagingScannerHealth("https://attacker.example", secret, fake), denied);
  await assert.rejects(verifyAuthorizedStagingScannerHealth(origin, "short", fake), denied);
});

test("rejects unauthorized, unhealthy, and redirect responses", async () => {
  for (const status of [302, 401, 503]) {
    const fake = (async () => new Response(null, { status })) as typeof fetch;
    await assert.rejects(verifyAuthorizedStagingScannerHealth(origin, secret, fake), denied);
  }
});

test("rejects incorrect, malformed, and oversized health bodies", async () => {
  for (const body of ['{"status":"error"}', '{bad', JSON.stringify({ status: "ok", secret: "unexpected" }),
    JSON.stringify({ status: "ok", padding: "x".repeat(200) })]) {
    const fake = (async () => new Response(body, {
      status: 200, headers: { "content-type": "application/json" },
    })) as typeof fetch;
    await assert.rejects(verifyAuthorizedStagingScannerHealth(origin, secret, fake), denied);
  }
});

test("rejects fetch exceptions without exposing the credential", async () => {
  const fake = (async () => { throw new Error(`upstream: ${secret}`); }) as typeof fetch;
  await assert.rejects(verifyAuthorizedStagingScannerHealth(origin, secret, fake), (error: unknown) => {
    assert.equal((error as Error).message, STAGING_SCANNER_HEALTH_DENIED);
    return true;
  });
});

test("refuses declared oversized or invalid length before consuming health body", async () => {
  for (const length of ["129", "not-a-number", "9999999999999999"]) {
    const fake = (async () => new Response('{"status":"ok"}', {
      status: 200, headers: { "content-type": "application/json", "content-length": length },
    })) as typeof fetch;
    await assert.rejects(verifyAuthorizedStagingScannerHealth(origin, secret, fake), denied);
  }
});

test("rejects a streaming body above 128 bytes even with a false small length", async () => {
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) { controller.enqueue(new Uint8Array(129).fill(32)); },
    cancel() { cancelled = true; },
  }, { highWaterMark: 0 });
  const fake = (async () => new Response(stream, {
    status: 200, headers: { "content-type": "application/json", "content-length": "1" },
  })) as typeof fetch;
  await assert.rejects(verifyAuthorizedStagingScannerHealth(origin, secret, fake), denied);
  assert.equal(cancelled, true, "oversized health stream must be cancelled immediately");
});
