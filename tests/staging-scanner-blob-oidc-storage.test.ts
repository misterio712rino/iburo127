import assert from "node:assert/strict";
import test from "node:test";
import { createOidcScopedScannerSmokeStorage } from "../scripts/staging-scanner-blob-oidc-storage";

const sha = "a".repeat(40);
const pathname = `security-fixtures/file-scanner/${sha}/12345-1/clean.txt`;
const host = "teststore123.private.blob.vercel-storage.com";
const env = {
  NODE_ENV: "test" as const,
  IB_STAGING_BASE_URL: "https://iburo127-app-git-audit-pr-0d0d70-misterio712rino-9166s-projects.vercel.app",
  IB_STAGING_SCANNER_FIXTURE_AUTH_MODE: "github-oidc",
  IB_STAGING_VERCEL_BLOB_PRIVATE_HOST: host,
  GITHUB_SHA: sha, GITHUB_RUN_ID: "12345", GITHUB_RUN_ATTEMPT: "1",
  IB_STAGING_FILE_SCANNER_CLEAN_OBJECT_KEY: pathname,
  IB_STAGING_FILE_SCANNER_MALICIOUS_OBJECT_KEY: `security-fixtures/file-scanner/${sha}/12345-1/eicar.txt`,
  ACTIONS_ID_TOKEN_REQUEST_URL: "https://token.actions.githubusercontent.com/request?x=1",
  ACTIONS_ID_TOKEN_REQUEST_TOKEN: "internal-runner-token-not-a-blob-token",
  VERCEL_AUTOMATION_BYPASS_SECRET: "private-bypass-placeholder",
};
const etag = '"0123456789abcdef0123456789abcdef"';
const denied = /STAGING_SCANNER_OIDC_STORAGE_DENIED/;
function harness(headStatus = 404, headEtag = etag) {
  const events: string[] = [];
  const request = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const parsed = new URL(url);
    if (/^[a-z0-9-]+\.actions\.githubusercontent\.com$/.test(parsed.hostname)) {
      events.push("oidc");
      assert.equal(new URL(url).searchParams.get("audience"), "iburo-staging-file-scanner-fixtures-v1");
      return Response.json({ value: "a".repeat(200) });
    }
    if (url.endsWith("/_iburo/staging-scanner-fixture-url")) {
      const body = JSON.parse(String(init?.body)) as { fixture: string; operation: string; etag?: string };
      events.push(`issue:${body.operation}`);
      const headers = new Headers(init?.headers);
      assert.equal(headers.get("x-vercel-protection-bypass"), env.VERCEL_AUTOMATION_BYPASS_SECRET);
      assert.equal(headers.get("x-iburo-staging-control"), env.VERCEL_AUTOMATION_BYPASS_SECRET);
      const key = body.fixture === "clean" ? pathname : env.IB_STAGING_FILE_SCANNER_MALICIOUS_OBJECT_KEY;
      if (body.operation === "delete") events.push(`delete-etag:${body.etag}`);
      const direct = body.operation === "head" || body.operation === "get"
        ? `https://${host}/${key}`
        : `https://vercel.com/api/blob/?pathname=${encodeURIComponent(key)}`;
      return Response.json({ url: `${direct}${direct.includes("?") ? "&" : "?"}vercel-blob-delegation=d&vercel-blob-signature=s`, expiresInSeconds: 120 });
    }
    if (init?.method === "HEAD") {
      events.push("head");
      return new Response(null, { status: headStatus, headers: {
        "content-length": "35", "content-type": "application/octet-stream", etag: headEtag,
      } });
    }
    if (init?.method === "DELETE") { events.push("delete"); return new Response(null, { status: 204 }); }
    throw new Error("unexpected test request");
  }) as typeof fetch;
  return { events, request };
}

test("rejects foreign object paths, origin and auth mode before any HTTP request", async () => {
  for (const override of [
    { IB_STAGING_BASE_URL: "https://attacker.example" },
    { IB_STAGING_SCANNER_FIXTURE_AUTH_MODE: "read-write-token" },
    { GITHUB_RUN_ID: "54321" },
  ]) {
    const h = harness();
    const storage = createOidcScopedScannerSmokeStorage({ ...env, ...override }, h.request);
    await assert.rejects(storage.createPrivateDownloadUrl({ pathname, expiresInSeconds: 120 }), denied);
    assert.deepEqual(h.events, []);
  }
  const h = harness();
  const storage = createOidcScopedScannerSmokeStorage(env, h.request);
  await assert.rejects(storage.statPrivateBlob("cases/actual-client/document.pdf"), denied);
  await assert.rejects(storage.deletePrivateBlob("cases/actual-client/document.pdf"), denied);
  assert.deepEqual(h.events, []);
});

test("issues only exact short-lived URLs using a fresh GitHub OIDC assertion", async () => {
  const h = harness();
  const storage = createOidcScopedScannerSmokeStorage(env, h.request);
  const getUrl = await storage.createPrivateDownloadUrl({ pathname, expiresInSeconds: 120 });
  assert.equal(new URL(getUrl).hostname, host);
  assert.equal(new URL(getUrl).pathname, `/${pathname}`);
  assert.deepEqual(h.events, ["oidc", "issue:get"]);
  const putUrl = await storage.createPrivateUploadUrl({
    pathname: env.IB_STAGING_FILE_SCANNER_MALICIOUS_OBJECT_KEY,
    mimeType: "application/octet-stream", maximumSizeInBytes: 68,
    expiresInSeconds: 120,
  });
  assert.equal(new URL(putUrl).origin, "https://vercel.com");
  assert.equal(new URL(putUrl).searchParams.get("pathname"), env.IB_STAGING_FILE_SCANNER_MALICIOUS_OBJECT_KEY);
  assert.deepEqual(h.events, ["oidc", "issue:get", "oidc", "issue:put"]);
  assert.ok(!JSON.stringify([getUrl, putUrl]).includes(env.ACTIONS_ID_TOKEN_REQUEST_TOKEN));
});

test("refuses oversized or overwriting uploads without requesting OIDC", async () => {
  for (const input of [
    { mimeType: "text/plain", maximumSizeInBytes: 35, allowOverwrite: false },
    { mimeType: "application/octet-stream", maximumSizeInBytes: 1025, allowOverwrite: false },
    { mimeType: "application/octet-stream", maximumSizeInBytes: 35, allowOverwrite: true },
  ]) {
    const h = harness();
    const storage = createOidcScopedScannerSmokeStorage(env, h.request);
    await assert.rejects(storage.createPrivateUploadUrl({ pathname, expiresInSeconds: 120, ...input }), denied);
    assert.deepEqual(h.events, []);
  }
});

test("404 metadata is absence and never authorizes deletion", async () => {
  const h = harness(404);
  const storage = createOidcScopedScannerSmokeStorage(env, h.request);
  assert.equal(await storage.statPrivateBlob(pathname), null);
  await assert.rejects(storage.deletePrivateBlob(pathname), denied);
  assert.deepEqual(h.events, ["oidc", "issue:head", "head"]);
});

test("deletes only after acknowledged upload and matching ETag", async () => {
  const h = harness(200);
  const storage = createOidcScopedScannerSmokeStorage(env, h.request);
  await assert.rejects(storage.deletePrivateBlob(pathname), denied);
  assert.deepEqual(h.events, []);
  assert.deepEqual(await storage.statPrivateBlob(pathname), {
    sizeBytes: BigInt(35), mimeType: "application/octet-stream",
  });
  await assert.rejects(storage.deletePrivateBlob(pathname), denied);
  storage.confirmUploadedFixture(pathname);
  await storage.deletePrivateBlob(pathname);
  assert.deepEqual(h.events, [
    "oidc", "issue:head", "head", "oidc", "issue:delete", `delete-etag:${etag}`, "delete",
  ]);
  await assert.rejects(storage.deletePrivateBlob(pathname), denied);
});

test("preexisting fixture metadata never authorizes cleanup without this run upload", async () => {
  const h = harness(200);
  const storage = createOidcScopedScannerSmokeStorage(env, h.request);
  await storage.statPrivateBlob(pathname);
  await assert.rejects(storage.deletePrivateBlob(pathname), denied);
  assert.throws(() => storage.confirmUploadedFixture("cases/actual-client/document.pdf"), denied);
  assert.deepEqual(h.events, ["oidc", "issue:head", "head"]);
});

test("invalid metadata must not authorize deletion", async () => {
  const h = harness(200, "bad etag");
  const storage = createOidcScopedScannerSmokeStorage(env, h.request);
  await assert.rejects(storage.statPrivateBlob(pathname), denied);
  await assert.rejects(storage.deletePrivateBlob(pathname), denied);
  assert.deepEqual(h.events, ["oidc", "issue:head", "head"]);
});

test("accepts GitHub Actions sharded OIDC request hosts", async () => {
  const h = harness();
  const storage = createOidcScopedScannerSmokeStorage({
    ...env,
    ACTIONS_ID_TOKEN_REQUEST_URL:
      "https://pipelinesghubeus13.actions.githubusercontent.com/request?x=1",
  }, h.request);
  const url = await storage.createPrivateDownloadUrl({ pathname, expiresInSeconds: 120 });
  assert.equal(new URL(url).hostname, host);
  assert.deepEqual(h.events, ["oidc", "issue:get"]);
});

test("surfaces only an allowlisted Preview issuer diagnostic reason", async () => {
  const request = (async (input: RequestInfo | URL) => {
    const parsed = new URL(String(input));
    if (/^[a-z0-9-]+\.actions\.githubusercontent\.com$/.test(parsed.hostname)) {
      return Response.json({ value: "a".repeat(200) });
    }
    return Response.json(
      { available: false },
      { status: 404, headers: { "x-iburo-staging-scanner-diagnostic": "OIDC" } },
    );
  }) as typeof fetch;
  const storage = createOidcScopedScannerSmokeStorage(env, request);
  await assert.rejects(
    storage.createPrivateDownloadUrl({ pathname, expiresInSeconds: 120 }),
    (error: unknown) => error instanceof Error &&
      error.message === "STAGING_SCANNER_OIDC_STORAGE_DENIED:OIDC",
  );
});

test("surfaces an allowlisted Blob signed-token HTTP diagnostic", async () => {
  const request = (async (input: RequestInfo | URL) => {
    const parsed = new URL(String(input));
    if (/^[a-z0-9-]+\.actions\.githubusercontent\.com$/.test(parsed.hostname)) {
      return Response.json({ value: "a".repeat(200) });
    }
    return Response.json(
      { available: false },
      { status: 404, headers: {
        "x-iburo-staging-scanner-diagnostic": "BLOB_SIGNED_TOKEN_HTTP_403",
      } },
    );
  }) as typeof fetch;
  const storage = createOidcScopedScannerSmokeStorage(env, request);
  await assert.rejects(
    storage.createPrivateDownloadUrl({ pathname, expiresInSeconds: 120 }),
    (error: unknown) => error instanceof Error &&
      error.message === "STAGING_SCANNER_OIDC_STORAGE_DENIED:BLOB_SIGNED_TOKEN_HTTP_403",
  );
});

test("does not reflect an unrecognized Preview issuer diagnostic value", async () => {
  const request = (async (input: RequestInfo | URL) => {
    const parsed = new URL(String(input));
    if (/^[a-z0-9-]+\.actions\.githubusercontent\.com$/.test(parsed.hostname)) {
      return Response.json({ value: "a".repeat(200) });
    }
    return Response.json(
      { available: false },
      { status: 404, headers: { "x-iburo-staging-scanner-diagnostic": "unexpected-private-value" } },
    );
  }) as typeof fetch;
  const storage = createOidcScopedScannerSmokeStorage(env, request);
  await assert.rejects(
    storage.createPrivateDownloadUrl({ pathname, expiresInSeconds: 120 }),
    (error: unknown) => error instanceof Error &&
      error.message === "STAGING_SCANNER_OIDC_STORAGE_DENIED",
  );
});

test("OIDC request URL cannot redirect token outside one GitHub Actions host label", async () => {
  for (const requestUrl of [
    "https://attacker.example/request",
    "https://actions.githubusercontent.com/request",
    "https://foo.bar.actions.githubusercontent.com/request",
    "https://actions.githubusercontent.com.attacker.example/request",
    "https://user@token.actions.githubusercontent.com/request",
    "https://token.actions.githubusercontent.com:444/request",
  ]) {
    const h = harness();
    const storage = createOidcScopedScannerSmokeStorage({
      ...env, ACTIONS_ID_TOKEN_REQUEST_URL: requestUrl,
    }, h.request);
    await assert.rejects(storage.createPrivateDownloadUrl({ pathname, expiresInSeconds: 120 }), denied);
    assert.deepEqual(h.events, []);
  }
});

test("oversized GitHub OIDC response denies before calling the Preview issuer", async () => {
  const calls: string[] = [];
  const request = (async (input: RequestInfo | URL) => {
    calls.push(String(input));
    return new Response("{}", { headers: { "content-length": "20000" } });
  }) as typeof fetch;
  const storage = createOidcScopedScannerSmokeStorage(env, request);
  await assert.rejects(storage.createPrivateDownloadUrl({ pathname, expiresInSeconds: 120 }), denied);
  assert.equal(calls.length, 1);
  assert.match(calls[0], /^https:\/\/[a-z0-9-]+\.actions\.githubusercontent\.com\//);
});

test("oversized Preview issuer response denies before any Blob request", async () => {
  const calls: string[] = [];
  const request = (async (input: RequestInfo | URL) => {
    calls.push(String(input));
    if (calls.length === 1) return Response.json({ value: "a".repeat(200) });
    return new Response("x".repeat(9000));
  }) as typeof fetch;
  const storage = createOidcScopedScannerSmokeStorage(env, request);
  await assert.rejects(storage.createPrivateDownloadUrl({ pathname, expiresInSeconds: 120 }), denied);
  assert.equal(calls.length, 2);
  assert.ok(calls[1].endsWith("/_iburo/staging-scanner-fixture-url"));
});

test("null GitHub OIDC JSON rejects with generic marker before Preview", async () => {
  const calls: string[] = [];
  const request = (async (input: RequestInfo | URL) => {
    calls.push(String(input));
    return Response.json(null);
  }) as typeof fetch;
  const storage = createOidcScopedScannerSmokeStorage(env, request);
  await assert.rejects(storage.createPrivateDownloadUrl({ pathname, expiresInSeconds: 120 }), denied);
  assert.equal(calls.length, 1);
});

test("null Preview issuer JSON rejects with generic marker before Blob", async () => {
  const calls: string[] = [];
  const request = (async (input: RequestInfo | URL) => {
    calls.push(String(input));
    if (calls.length === 1) return Response.json({ value: "a".repeat(200) });
    return Response.json(null);
  }) as typeof fetch;
  const storage = createOidcScopedScannerSmokeStorage(env, request);
  await assert.rejects(storage.createPrivateDownloadUrl({ pathname, expiresInSeconds: 120 }), denied);
  assert.equal(calls.length, 2);
});
