import assert from "node:assert/strict";
import test from "node:test";
import { createOidcScopedScannerSmokeStorage } from "../scripts/staging-scanner-blob-oidc-storage";

const sha = "a".repeat(40);
const pathname = `security-fixtures/file-scanner/${sha}/12345-1/clean.txt`;
const host = "teststore123.private.blob.vercel-storage.com";
const env = {
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
    if (url.startsWith("https://token.actions.githubusercontent.com/")) {
      events.push("oidc");
      assert.equal(new URL(url).searchParams.get("audience"), "iburo-staging-file-scanner-fixtures-v1");
      return Response.json({ value: "a".repeat(200) });
    }
    if (url.endsWith("/_iburo/staging-scanner-fixture-url")) {
      const body = JSON.parse(String(init?.body)) as { fixture: string; operation: string; etag?: string };
      events.push(`issue:${body.operation}`);
      assert.equal(new Headers(init?.headers).get("x-vercel-protection-bypass"), env.VERCEL_AUTOMATION_BYPASS_SECRET);
      const direct = body.operation === "head" || body.operation === "get"
        ? `https://${host}/${pathname}`
        : `https://vercel.com/api/blob/?pathname=${encodeURIComponent(pathname)}`;
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
