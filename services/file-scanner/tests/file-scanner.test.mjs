import assert from "node:assert/strict";
import { EventEmitter, once } from "node:events";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import net from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import test from "node:test";

import { authorizeRawHeaders } from "../src/auth.mjs";
import { openClamdInstream, pingClamd } from "../src/clamd-client.mjs";
import { readScannerConfig } from "../src/config.mjs";
import { MAX_FILE_BYTES } from "../src/constants.mjs";
import { createPinnedLookup, resolvePublicAddress } from "../src/dns-pinning.mjs";
import { scanRemoteObject, streamResponseToClamd } from "../src/download-scanner.mjs";
import { isPublicRoutableAddress } from "../src/ip-policy.mjs";
import { parseScanRequest } from "../src/request-policy.mjs";
import { createScannerServer } from "../src/service.mjs";
import { assertSignaturesFresh } from "../src/signature-freshness.mjs";
import { assertTrustedSourceUrl } from "../src/source-url-policy.mjs";

const SECRET = "scanner-test-secret-that-is-longer-than-thirty-two-characters";
const VERCEL_URL = "https://abc123.private.blob.vercel-storage.com/security-fixtures/file-scanner/clean.txt?cache=0&vercel-blob-delegation=delegation&vercel-blob-signature=signature";
const YANDEX_URL = "https://fixture-bucket.storage.yandexcloud.net/security-fixtures/file-scanner/clean.txt?X-Amz-Signature=signature";
const PDF_INPUT = { sourceUrl: VERCEL_URL, mimeType: "application/pdf", sizeBytes: "3" };

function config(overrides = {}) {
  return {
    secret: SECRET,
    host: "127.0.0.1",
    port: 8080,
    concurrency: 2,
    requestBodyTimeoutMs: 100,
    dnsTimeoutMs: 100,
    connectTimeoutMs: 100,
    downloadTimeoutMs: 100,
    clamdConnectTimeoutMs: 100,
    clamdScanTimeoutMs: 100,
    totalTimeoutMs: 500,
    clamdHost: "127.0.0.1",
    clamdPort: 3310,
    signatureDirectory: "/var/lib/clamav",
    signatureMaxAgeHours: 24,
    ...overrides,
  };
}

function expectReject(action, pattern = /./) {
  assert.throws(action, pattern);
}

test("scanner configuration validates the secret and bounded resource settings", () => {
  const parsed = readScannerConfig({ IB_FILE_SCANNER_SECRET: SECRET });
  assert.equal(parsed.concurrency, 2);
  assert.equal(parsed.totalTimeoutMs, 55_000);
  expectReject(() => readScannerConfig({ IB_FILE_SCANNER_SECRET: "short" }), /SCANNER_CONFIG_INVALID/);
  expectReject(() => readScannerConfig({ IB_FILE_SCANNER_SECRET: SECRET, IB_SCANNER_MAX_CONCURRENCY: "9" }), /SCANNER_CONFIG_INVALID/);
  expectReject(() => readScannerConfig({ IB_FILE_SCANNER_SECRET: SECRET, IB_SCANNER_CLAMD_HOST: "clamd.example" }), /SCANNER_CONFIG_INVALID/);
});

test("authorization requires exactly one correctly formed bearer credential", () => {
  expectReject(() => authorizeRawHeaders([], SECRET), /UNAUTHORIZED/);
  expectReject(() => authorizeRawHeaders(["Authorization", `Basic ${SECRET}`], SECRET), /UNAUTHORIZED/);
  expectReject(() => authorizeRawHeaders(["Authorization", "Bearer incorrect-secret-that-is-also-long-enough"], SECRET), /UNAUTHORIZED/);
  expectReject(() => authorizeRawHeaders(["Authorization", `Bearer ${SECRET}`, "Authorization", `Bearer ${SECRET}`], SECRET), /UNAUTHORIZED/);
  assert.doesNotThrow(() => authorizeRawHeaders(["Authorization", `Bearer ${SECRET}`], SECRET));
});

test("request schema and MIME policy are exact and bounded", () => {
  assert.deepEqual(parseScanRequest(PDF_INPUT), { ...PDF_INPUT, sizeBytes: 3 });
  for (const mimeType of [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ]) {
    assert.equal(parseScanRequest({ ...PDF_INPUT, mimeType }).mimeType, mimeType);
  }
  for (const invalid of [
    null,
    [],
    { ...PDF_INPUT, extra: true },
    { ...PDF_INPUT, sourceUrl: 1 },
    { ...PDF_INPUT, mimeType: "text/plain" },
    { ...PDF_INPUT, sizeBytes: "0" },
    { ...PDF_INPUT, sizeBytes: "01" },
    { ...PDF_INPUT, sizeBytes: "1.5" },
    { ...PDF_INPUT, sizeBytes: String(MAX_FILE_BYTES + 1) },
  ]) expectReject(() => parseScanRequest(invalid), /INVALID_REQUEST/);
});

test("trusted source URL policy accepts only signed Yandex and delegated private Vercel families", () => {
  assert.equal(assertTrustedSourceUrl(YANDEX_URL).hostname, "fixture-bucket.storage.yandexcloud.net");
  assert.equal(assertTrustedSourceUrl(VERCEL_URL).hostname, "abc123.private.blob.vercel-storage.com");
  const invalid = [
    "https://attacker.example/file?vercel-blob-delegation=a&vercel-blob-signature=b",
    VERCEL_URL.replace("https:", "http:"),
    VERCEL_URL.replace("https://", "https://user:password@"),
    VERCEL_URL.replace(".com/", ".com:444/"),
    VERCEL_URL.replace(".com/", ".com:443/"),
    `${VERCEL_URL}#fragment`,
    VERCEL_URL.replace("abc123.", ""),
    VERCEL_URL.replace("abc123.", "foo.bar."),
    VERCEL_URL.replace(".com/", ".com.attacker.example/"),
    VERCEL_URL.replace("vercel-blob-delegation=delegation&", ""),
    VERCEL_URL.replace("&vercel-blob-signature=signature", ""),
    VERCEL_URL.replace("vercel-blob-delegation=delegation", "vercel-blob-delegation="),
    VERCEL_URL.replace("vercel-blob-signature=signature", "vercel-blob-signature="),
    `${VERCEL_URL}&vercel-blob-delegation=second`,
    `${VERCEL_URL}&vercel-blob-signature=second`,
    YANDEX_URL.replace("X-Amz-Signature=signature", "X-Amz-Signature="),
    `${YANDEX_URL}&X-Amz-Signature=second`,
  ];
  for (const value of invalid) expectReject(() => assertTrustedSourceUrl(value), /SOURCE_URL_REJECTED/);
});

test("IP policy rejects private, local, reserved, mapped and non-routable addresses", () => {
  for (const address of [
    "127.0.0.1", "10.0.0.1", "172.16.1.1", "192.168.1.1", "169.254.1.1",
    "0.0.0.0", "224.0.0.1", "192.0.2.1", "::1", "::", "fc00::1", "fe80::1",
    "ff02::1", "2001:db8::1", "::ffff:127.0.0.1", "::ffff:192.168.1.1",
  ]) assert.equal(isPublicRoutableAddress(address), false, address);
  assert.equal(isPublicRoutableAddress("8.8.8.8"), true);
  assert.equal(isPublicRoutableAddress("2606:4700:4700::1111"), true);
});

test("DNS rejects mixed public/private answers and creates a hostname-bound pinned lookup", async () => {
  await assert.rejects(
    resolvePublicAddress("abc123.private.blob.vercel-storage.com", 100, async () => [
      { address: "8.8.8.8", family: 4 },
      { address: "127.0.0.1", family: 4 },
    ]),
    /DNS_ADDRESS_REJECTED/,
  );
  const pinned = await resolvePublicAddress("abc123.private.blob.vercel-storage.com", 100, async () => [
    { address: "8.8.8.8", family: 4 },
  ]);
  const lookup = createPinnedLookup("abc123.private.blob.vercel-storage.com", pinned);
  const result = await new Promise((resolve, reject) => lookup("abc123.private.blob.vercel-storage.com", {}, (error, address, family) => error ? reject(error) : resolve({ address, family })));
  assert.deepEqual(result, { address: "8.8.8.8", family: 4 });
  await assert.rejects(new Promise((resolve, reject) => lookup("attacker.example", {}, (error) => error ? reject(error) : resolve())), /PINNED_DNS_HOST_MISMATCH/);
});

function response(statusCode, headers, chunks) {
  const stream = Readable.from(chunks);
  stream.statusCode = statusCode;
  stream.headers = headers;
  stream.setTimeout = () => stream;
  return stream;
}

function fakeClamd(verdict = "CLEAN") {
  const chunks = [];
  return {
    chunks,
    destroyed: false,
    async writeChunk(chunk) { chunks.push(Buffer.from(chunk)); },
    async finish() { return verdict; },
    destroy() { this.destroyed = true; },
  };
}

test("download streaming enforces status, encoding, declared and actual byte counts", async () => {
  assert.equal(await streamResponseToClamd(response(200, { "content-length": "3" }, [Buffer.from("abc")]), 3, fakeClamd()), "CLEAN");
  for (const candidate of [
    response(302, { location: "https://attacker.example" }, []),
    response(500, {}, []),
    response(200, { "content-encoding": "gzip" }, [Buffer.from("abc")]),
    response(200, { "content-length": "4" }, [Buffer.from("abc")]),
    response(200, {}, [Buffer.from("ab")]),
    response(200, {}, [Buffer.from("abcd")]),
  ]) await assert.rejects(streamResponseToClamd(candidate, 3, fakeClamd()), /DOWNLOAD_/);
});

test("the validated DNS address is pinned into the actual TLS request while SNI keeps the hostname", async () => {
  let observed;
  const requestImpl = (url, options, callback) => {
    observed = { url, options };
    const request = new EventEmitter();
    request.setTimeout = () => request;
    request.end = () => callback(response(200, { "content-length": "3" }, [Buffer.from("abc")]));
    request.destroy = (error) => error && request.emit("error", error);
    return request;
  };
  const verdict = await scanRemoteObject(
    { sourceUrl: new URL(VERCEL_URL), mimeType: "application/pdf", sizeBytes: 3 },
    config(),
    {
      assertSignaturesFresh: async () => {},
      resolvePublicAddress: async () => ({ address: "8.8.8.8", family: 4 }),
      openClamdInstream: async () => fakeClamd(),
      httpsRequest: requestImpl,
    },
  );
  assert.equal(verdict, "CLEAN");
  assert.equal(observed.options.servername, "abc123.private.blob.vercel-storage.com");
  assert.equal(observed.options.agent, false);
  assert.equal(observed.options.headers.Authorization, undefined);
  const pinned = await new Promise((resolve, reject) => observed.options.lookup(observed.url.hostname, {}, (error, address, family) => error ? reject(error) : resolve({ address, family })));
  assert.deepEqual(pinned, { address: "8.8.8.8", family: 4 });
});

test("the total scanner budget aborts a download that never completes", async () => {
  const requestImpl = (_url, _options, callback) => {
    const request = new EventEmitter();
    request.setTimeout = () => request;
    request.end = () => callback(response(200, {}, [
      Buffer.from("a"),
      new Promise(() => {}),
    ]));
    request.destroy = (error) => error && request.emit("error", error);
    return request;
  };
  await assert.rejects(
    scanRemoteObject(
      { sourceUrl: new URL(VERCEL_URL), mimeType: "application/pdf", sizeBytes: 3 },
      config({ totalTimeoutMs: 30 }),
      {
        assertSignaturesFresh: async () => {},
        resolvePublicAddress: async () => ({ address: "8.8.8.8", family: 4 }),
        openClamdInstream: async () => fakeClamd(),
        httpsRequest: requestImpl,
      },
    ),
    /SCAN_TIMEOUT/,
  );
});

async function fakeClamdServer(reply, { neverReply = false } = {}) {
  const server = net.createServer((socket) => {
    const buffers = [];
    socket.on("data", (chunk) => {
      buffers.push(chunk);
      const received = Buffer.concat(buffers);
      const ping = received.equals(Buffer.from("zPING\0"));
      const endOfStream = received.length >= 4 && received.subarray(-4).equals(Buffer.alloc(4));
      if (!neverReply && (ping || endOfStream)) {
        socket.end(Buffer.from(`${reply}\0`));
      }
    });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return server;
}

test("clamd INSTREAM maps OK and FOUND and rejects ERROR/malformed responses", async () => {
  for (const [reply, expected] of [
    ["stream: OK", "CLEAN"],
    ["stream: Eicar-Test-Signature FOUND", "MALICIOUS"],
  ]) {
    const server = await fakeClamdServer(reply);
    try {
      const session = await openClamdInstream(config({ clamdPort: server.address().port }));
      await session.writeChunk(Buffer.from("abc"));
      assert.equal(await session.finish(), expected);
    } finally {
      server.close();
    }
  }
  for (const reply of ["stream: ERROR", "unexpected"]) {
    const server = await fakeClamdServer(reply);
    try {
      const session = await openClamdInstream(config({ clamdPort: server.address().port }));
      await session.writeChunk(Buffer.from("abc"));
      await assert.rejects(session.finish(), /CLAMD_SCAN_FAILURE/);
    } finally {
      server.close();
    }
  }
});

test("clamd unavailable and timeout paths fail closed", async () => {
  const unavailable = net.createServer();
  unavailable.listen(0, "127.0.0.1");
  await once(unavailable, "listening");
  const port = unavailable.address().port;
  await new Promise((resolve) => unavailable.close(resolve));
  await assert.rejects(openClamdInstream(config({ clamdPort: port })), /CLAMD_UNAVAILABLE/);

  const hanging = await fakeClamdServer("", { neverReply: true });
  try {
    const session = await openClamdInstream(config({ clamdPort: hanging.address().port, clamdScanTimeoutMs: 30 }));
    await session.writeChunk(Buffer.from("abc"));
    await assert.rejects(session.finish(), /CLAMD_SCAN_FAILURE/);
  } finally {
    hanging.close();
  }
});

test("health primitives require fresh signature files and reachable clamd", async () => {
  const directory = await mkdtemp(join(tmpdir(), "iburo-scanner-signatures-"));
  try {
    await writeFile(join(directory, "main.cvd"), "main");
    await writeFile(join(directory, "daily.cvd"), "daily");
    await assertSignaturesFresh(config({ signatureDirectory: directory }), { now: () => Date.now() + 1_000 });
    await assert.rejects(assertSignaturesFresh(config({ signatureDirectory: directory, signatureMaxAgeHours: 1 }), { now: () => Date.now() + 2 * 60 * 60 * 1000 }), /SIGNATURES_STALE/);
    await rm(join(directory, "daily.cvd"));
    await assert.rejects(assertSignaturesFresh(config({ signatureDirectory: directory })), /SIGNATURES_UNAVAILABLE/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }

  const server = await fakeClamdServer("PONG");
  try {
    await pingClamd(config({ clamdPort: server.address().port }));
  } finally {
    server.close();
  }
});

async function startService(overrides = {}) {
  const logs = [];
  const server = createScannerServer(config({ concurrency: 1 }), {
    logger: (event, category) => logs.push(JSON.stringify({ event, category })),
    checkHealth: overrides.checkHealth ?? (async () => {}),
    scanRemoteObject: overrides.scanRemoteObject ?? (async () => "CLEAN"),
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return { server, logs, origin: `http://127.0.0.1:${server.address().port}` };
}

async function post(origin, body, headers = {}) {
  return fetch(`${origin}/v1/scan-url`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SECRET}`, "Content-Type": "application/json", Accept: "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

test("HTTP service keeps success responses exact and health authenticated", async () => {
  const { server, origin } = await startService();
  try {
    const unauthorized = await fetch(`${origin}/health`);
    assert.equal(unauthorized.status, 401);
    const health = await fetch(`${origin}/health`, { headers: { Authorization: `Bearer ${SECRET}` } });
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { status: "ok" });
    const result = await post(origin, PDF_INPUT);
    assert.equal(result.status, 200);
    assert.equal(await result.text(), '{"verdict":"CLEAN"}');
    assert.equal(result.headers.get("cache-control"), "no-store");
    assert.equal(result.headers.get("pragma"), "no-cache");
    assert.equal(result.headers.get("x-content-type-options"), "nosniff");
  } finally {
    server.close();
  }
});

test("unhealthy readiness is a generic fail-closed 503", async () => {
  const { server, origin } = await startService({
    checkHealth: async () => { throw new Error(`${VERCEL_URL} must stay private`); },
  });
  try {
    const result = await fetch(`${origin}/health`, { headers: { Authorization: `Bearer ${SECRET}` } });
    assert.equal(result.status, 503);
    assert.deepEqual(await result.json(), { error: "REQUEST_FAILED" });
  } finally {
    server.close();
  }
});

test("HTTP request body, headers and schema fail closed", async () => {
  const { server, origin } = await startService();
  try {
    assert.equal((await post(origin, "{" )).status, 400);
    assert.equal((await post(origin, { ...PDF_INPUT, extra: true })).status, 400);
    assert.equal((await post(origin, PDF_INPUT, { "Content-Type": "text/plain" })).status, 415);
    assert.equal((await post(origin, PDF_INPUT, { Accept: "text/plain" })).status, 406);
    assert.equal((await post(origin, "x".repeat(8_193))).status, 400);
  } finally {
    server.close();
  }
});

test("logs and public errors redact source capabilities, object keys, secrets and raw failures", async () => {
  const marker = "EICAR-TEST-CONTENT-MUST-NOT-LOG";
  const { server, origin, logs } = await startService({
    scanRemoteObject: async () => { throw new Error(`${VERCEL_URL} ${SECRET} ${marker}`); },
  });
  try {
    const result = await post(origin, PDF_INPUT);
    assert.equal(result.status, 503);
    const combined = `${logs.join("\n")} ${await result.text()}`;
    for (const forbidden of [VERCEL_URL, "vercel-blob-delegation", "clean.txt", SECRET, marker]) {
      assert.doesNotMatch(combined, new RegExp(forbidden.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
  } finally {
    server.close();
  }
});

test("concurrency is bounded and overload fails immediately without an unbounded queue", async () => {
  let releaseFirst;
  const blocked = new Promise((resolve) => { releaseFirst = resolve; });
  const { server, origin } = await startService({ scanRemoteObject: async () => blocked });
  try {
    const first = post(origin, PDF_INPUT);
    await new Promise((resolve) => setTimeout(resolve, 20));
    const overloaded = await post(origin, PDF_INPUT);
    assert.equal(overloaded.status, 503);
    releaseFirst("CLEAN");
    assert.equal((await first).status, 200);
  } finally {
    server.close();
  }
});

test("container contract keeps ClamAV persistent, refreshed and processes non-root", async () => {
  const serviceRoot = new URL("../", import.meta.url);
  const [dockerfile, entrypoint, clamd, freshclam] = await Promise.all([
    readFile(new URL("Dockerfile", serviceRoot), "utf8"),
    readFile(new URL("entrypoint.sh", serviceRoot), "utf8"),
    readFile(new URL("config/clamd.conf", serviceRoot), "utf8"),
    readFile(new URL("config/freshclam.conf", serviceRoot), "utf8"),
  ]);
  assert.match(dockerfile, /FROM node:24-bookworm-slim/);
  assert.match(dockerfile, /VOLUME \["\/var\/lib\/clamav"\]/);
  assert.match(dockerfile, /ENTRYPOINT \["\/usr\/bin\/tini"/);
  assert.doesNotMatch(dockerfile, /IB_FILE_SCANNER_SECRET=/);
  assert.match(entrypoint, /timeout 120s gosu clamav freshclam/);
  assert.match(entrypoint, /gosu clamav clamd/);
  assert.match(entrypoint, /gosu clamav node/);
  assert.match(clamd, /StreamMaxLength 50M/);
  assert.match(clamd, /LogClean false/);
  assert.match(freshclam, /Checks 12/);
  assert.match(freshclam, /NotifyClamd/);
});
