const FAIL = "STAGING_OPAQUE_CASE_COMPAT_FAIL";
const INTERNAL_CASE_NUMBER = /^IBR?-/iu;
const EXACT_GIT_SHA_PATTERN = /^[a-f0-9]{40}$/;

function fail(message) {
  throw new Error(`${FAIL}: ${message}`);
}

const enabled = process.env.IB_STAGING_OPAQUE_CASE_COMPAT?.trim();
const runtimeTarget = process.env.IB_RUNTIME_TARGET?.trim();
const exactSha = process.env.GITHUB_SHA?.trim() ?? "";
const confirmation = process.env.IB_STAGING_OPAQUE_CASE_COMPAT_CONFIRM?.trim();
const rawBaseUrl = process.env.IB_STAGING_BASE_URL?.trim();

if (enabled !== "1") fail("compatibility preload requires IB_STAGING_OPAQUE_CASE_COMPAT=1");
if (runtimeTarget !== "staging") fail("compatibility preload is restricted to staging runtime");
if (!EXACT_GIT_SHA_PATTERN.test(exactSha)) fail("compatibility preload requires exact lowercase GITHUB_SHA");
if (confirmation !== `OPAQUE_CASE_COMPAT:${exactSha}`) {
  fail("compatibility preload confirmation does not match exact GITHUB_SHA");
}
if (!rawBaseUrl) fail("compatibility preload requires IB_STAGING_BASE_URL");

let baseUrl;
try {
  baseUrl = new URL(rawBaseUrl);
} catch {
  fail("IB_STAGING_BASE_URL is not a valid URL");
}

const hostname = baseUrl.hostname.replace(/\.$/u, "").toLowerCase();
const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
if (baseUrl.protocol !== "https:" && !(isLocalhost && baseUrl.protocol === "http:")) {
  fail("compatibility preload requires HTTPS unless targeting localhost");
}
if (baseUrl.username || baseUrl.password) fail("compatibility preload target must not contain credentials");
if (baseUrl.pathname !== "/" || baseUrl.search || baseUrl.hash) {
  fail("compatibility preload target must be an origin-only URL");
}
if (hostname === "iburo127.ru" || hostname.endsWith(".iburo127.ru")) {
  fail("compatibility preload explicitly blocks production hosts");
}

const nativeFetch = globalThis.fetch;
if (typeof nativeFetch !== "function") fail("global fetch is unavailable");

function requireSafeCaseRecord(item, index) {
  if (!item || typeof item !== "object") {
    fail(`case transport item ${index} is not an object`);
  }
  if (typeof item.id !== "string" || !item.id.trim()) {
    fail(`case transport item ${index} is missing an opaque id`);
  }
  if (typeof item.caseNumber !== "string") {
    fail(`case transport item ${index} has a non-string caseNumber`);
  }
  if (INTERNAL_CASE_NUMBER.test(item.caseNumber.trim())) {
    fail("raw authenticated transport exposed an internal case number before compatibility rewrite");
  }
}

globalThis.fetch = async function stagingOpaqueCaseCompatibilityFetch(input, init) {
  const response = await nativeFetch(input, init);

  let responseUrl;
  try {
    responseUrl = new URL(response.url);
  } catch {
    return response;
  }

  if (responseUrl.origin !== baseUrl.origin || responseUrl.pathname !== "/api/platform/cases") {
    return response;
  }
  if (response.status !== 200) return response;

  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json")) {
    fail("case transport compatibility target returned non-JSON content");
  }

  const text = await response.clone().text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    fail("case transport compatibility target returned invalid JSON");
  }
  if (!body || body.ok !== true || !Array.isArray(body.data)) {
    fail("case transport compatibility target returned an invalid success envelope");
  }

  const seenIds = new Set();
  const rewrittenData = body.data.map((item, index) => {
    requireSafeCaseRecord(item, index);
    if (seenIds.has(item.id)) fail("case transport compatibility target returned duplicate opaque id");
    seenIds.add(item.id);
    return { ...item, caseNumber: item.id };
  });

  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.delete("content-encoding");
  headers.delete("transfer-encoding");
  headers.delete("etag");

  return new Response(JSON.stringify({ ...body, data: rewrittenData }), {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

console.log("STAGING_OPAQUE_CASE_COMPAT_ACTIVE: legacy E2E case lookup is mapped to opaque ids after raw privacy verification");
