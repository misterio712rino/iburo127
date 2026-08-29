import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  VERCEL_PREVIEW_BOUNDARY_ERROR,
  VERCEL_STAGING_BRANCH,
  VERCEL_STAGING_CONFIRMATION,
  assertVercelPreviewBackendAllowed,
  isVercelPreviewBackendAllowed,
} from "@/server/config/vercel-preview-boundary";
import {
  PLATFORM_MUTATION_ORIGIN_NOT_CONFIGURED,
  PLATFORM_MUTATION_ORIGIN_REJECTED,
  evaluatePlatformMutationOrigin,
} from "@/server/http/trusted-mutation-origin";

const productionEnv = { BETTER_AUTH_URL: "https://app.example.com" };

function request(
  method: string,
  options: { origin?: string; fetchSite?: string; userAgent?: string } = {},
): Pick<Request, "method" | "headers"> {
  const headers = new Headers();
  if (options.origin !== undefined) headers.set("origin", options.origin);
  if (options.fetchSite !== undefined) headers.set("sec-fetch-site", options.fetchSite);
  if (options.userAgent !== undefined) headers.set("user-agent", options.userAgent);
  return { method, headers };
}

for (const method of ["GET", "HEAD", "OPTIONS"]) {
  assert.deepEqual(evaluatePlatformMutationOrigin(request(method), {}), { allowed: true });
}

for (const method of ["POST", "PATCH", "PUT", "DELETE"]) {
  assert.deepEqual(
    evaluatePlatformMutationOrigin(
      request(method, { origin: "https://app.example.com", fetchSite: "same-origin" }),
      productionEnv,
    ),
    { allowed: true },
  );
}

assert.deepEqual(
  evaluatePlatformMutationOrigin(
    request("POST", { origin: "https://app.example.com" }),
    productionEnv,
  ),
  { allowed: true },
  "same-origin non-browser client may omit Fetch Metadata",
);

assert.deepEqual(
  evaluatePlatformMutationOrigin(
    request("POST", { userAgent: "node" }),
    productionEnv,
  ),
  { allowed: true },
  "repository Node staging verifier remains compatible without browser Origin headers",
);

for (const invalidRequest of [
  request("POST"),
  request("POST", { userAgent: "Node.js" }),
  request("POST", { userAgent: "node", fetchSite: "cross-site" }),
  request("POST", { userAgent: "node", origin: "https://evil.example" }),
  request("POST", { origin: "null" }),
  request("POST", { origin: "https://evil.example" }),
  request("POST", { origin: "https://sub.app.example.com" }),
  request("POST", { origin: "https://app.example.com/extra" }),
  request("POST", { origin: "https://app.example.com", fetchSite: "cross-site" }),
  request("POST", { origin: "https://app.example.com", fetchSite: "same-site" }),
  request("POST", { origin: "https://app.example.com", fetchSite: "none" }),
]) {
  assert.deepEqual(evaluatePlatformMutationOrigin(invalidRequest, productionEnv), {
    allowed: false,
    status: 403,
    code: PLATFORM_MUTATION_ORIGIN_REJECTED,
  });
}

for (const invalidEnv of [
  {},
  { BETTER_AUTH_URL: "" },
  { BETTER_AUTH_URL: "not-a-url" },
  { BETTER_AUTH_URL: "http://app.example.com" },
  { BETTER_AUTH_URL: "https://user:pass@app.example.com" },
  { BETTER_AUTH_URL: "https://app.example.com/path" },
  { BETTER_AUTH_URL: "https://app.example.com?query=1" },
]) {
  assert.deepEqual(
    evaluatePlatformMutationOrigin(
      request("PATCH", { origin: "https://app.example.com" }),
      invalidEnv,
    ),
    {
      allowed: false,
      status: 503,
      code: PLATFORM_MUTATION_ORIGIN_NOT_CONFIGURED,
    },
  );
}

assert.deepEqual(
  evaluatePlatformMutationOrigin(
    request("POST", { origin: "https://app.example.com" }),
    { BETTER_AUTH_URL: "https://app.example.com/" },
  ),
  { allowed: true },
  "configured application origin may include a conventional trailing slash",
);
assert.deepEqual(
  evaluatePlatformMutationOrigin(
    request("POST", { origin: "http://localhost:3000" }),
    { BETTER_AUTH_URL: "http://localhost:3000" },
  ),
  { allowed: true },
);
assert.deepEqual(
  evaluatePlatformMutationOrigin(
    request("POST", { origin: "http://127.0.0.1:3000" }),
    { BETTER_AUTH_URL: "http://127.0.0.1:3000" },
  ),
  { allowed: true },
);

assert.equal(isVercelPreviewBackendAllowed({}), true);
assert.equal(isVercelPreviewBackendAllowed({ VERCEL_ENV: "production" }), true);

for (const previewEnv of [
  { VERCEL_ENV: "preview" },
  {
    VERCEL_ENV: "preview",
    VERCEL_GIT_COMMIT_REF: VERCEL_STAGING_BRANCH,
  },
  {
    VERCEL_ENV: "preview",
    VERCEL_GIT_COMMIT_REF: VERCEL_STAGING_BRANCH,
    IB_RUNTIME_TARGET: "staging",
  },
  {
    VERCEL_ENV: "preview",
    VERCEL_GIT_COMMIT_REF: "main",
    IB_RUNTIME_TARGET: "staging",
    IB_VERCEL_PREVIEW_BACKEND_CONFIRM: VERCEL_STAGING_CONFIRMATION,
  },
  {
    VERCEL_ENV: "preview",
    VERCEL_GIT_COMMIT_REF: VERCEL_STAGING_BRANCH,
    IB_RUNTIME_TARGET: "production",
    IB_VERCEL_PREVIEW_BACKEND_CONFIRM: VERCEL_STAGING_CONFIRMATION,
  },
]) {
  assert.equal(isVercelPreviewBackendAllowed(previewEnv), false);
  assert.throws(
    () => assertVercelPreviewBackendAllowed(previewEnv),
    new RegExp(VERCEL_PREVIEW_BOUNDARY_ERROR),
  );
}

const confirmedPreviewEnv = {
  VERCEL_ENV: "preview",
  VERCEL_GIT_COMMIT_REF: VERCEL_STAGING_BRANCH,
  IB_RUNTIME_TARGET: "staging",
  IB_VERCEL_PREVIEW_BACKEND_CONFIRM: VERCEL_STAGING_CONFIRMATION,
};
assert.equal(isVercelPreviewBackendAllowed(confirmedPreviewEnv), true);
assert.doesNotThrow(() => assertVercelPreviewBackendAllowed(confirmedPreviewEnv));

const proxySource = await readFile(resolve("proxy.ts"), "utf8");
assert.match(proxySource, /isVercelPreviewBackendAllowed\(\)/);
assert.match(proxySource, /evaluatePlatformMutationOrigin\(request\)/);
assert.match(proxySource, /matcher:\s*\["\/app\/:path\*", "\/api\/:path\*"\]/);
assert.match(proxySource, /Cache-Control": "private, no-store"/);
assert.match(proxySource, /STAGING_BACKEND_DISABLED/);
assert.doesNotMatch(proxySource, /\/api\/auth/);
assert.doesNotMatch(proxySource, /\/api\/internal/);

console.log("PLATFORM_MUTATION_ORIGIN_TEST_PASS");
