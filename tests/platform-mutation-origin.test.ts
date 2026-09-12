import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  VERCEL_PREVIEW_BOUNDARY_ERROR,
  VERCEL_STAGING_BRANCH,
  VERCEL_STAGING_CONFIRMATION,
  VERCEL_STAGING_REPOSITORY_ID,
  VERCEL_STAGING_REPOSITORY_NAME,
  VERCEL_STAGING_REPOSITORY_OWNER,
  assertVercelPreviewBackendAllowed,
  isVercelPreviewBackendAllowed,
} from "@/server/config/vercel-preview-boundary";
import {
  PLATFORM_MUTATION_ORIGIN_NOT_CONFIGURED,
  PLATFORM_MUTATION_ORIGIN_REJECTED,
  evaluatePlatformMutationOrigin,
} from "@/server/http/trusted-mutation-origin";
import {
  IB_STAGING_CONTROL_HEADER,
  isAuthorizedVercelAutomationRequest,
} from "@/server/staging/vercel-automation-auth";

const productionEnv = { BETTER_AUTH_URL: "https://app.example.com" };
const confirmedCommitSha = "12a4155acd473838b3e4f48bc318016187854a68";
const confirmedPreviewEnv = {
  BETTER_AUTH_URL: "https://app.example.com",
  VERCEL_ENV: "preview",
  VERCEL_GIT_PROVIDER: "github",
  VERCEL_GIT_REPO_OWNER: VERCEL_STAGING_REPOSITORY_OWNER,
  VERCEL_GIT_REPO_SLUG: VERCEL_STAGING_REPOSITORY_NAME,
  VERCEL_GIT_REPO_ID: VERCEL_STAGING_REPOSITORY_ID,
  VERCEL_GIT_COMMIT_REF: VERCEL_STAGING_BRANCH,
  VERCEL_GIT_COMMIT_SHA: confirmedCommitSha,
  VERCEL_URL: "iburo127-test-deployment.vercel.app",
  IB_RUNTIME_TARGET: "staging",
};

function request(
  method: string,
  options: {
    origin?: string;
    fetchSite?: string;
    userAgent?: string;
    automationBypass?: string;
  } = {},
): Pick<Request, "method" | "headers"> {
  const headers = new Headers();
  if (options.origin !== undefined) headers.set("origin", options.origin);
  if (options.fetchSite !== undefined) headers.set("sec-fetch-site", options.fetchSite);
  if (options.userAgent !== undefined) headers.set("user-agent", options.userAgent);
  if (options.automationBypass !== undefined) {
    headers.set(IB_STAGING_CONTROL_HEADER, options.automationBypass);
  }
  return { method, headers };
}

assert.equal(IB_STAGING_CONTROL_HEADER, "x-iburo-staging-control");
assert.notEqual(
  IB_STAGING_CONTROL_HEADER,
  "x-vercel-protection-bypass",
  "application staging-control authentication must remain separate from Vercel's consumed protection-bypass header",
);

const automationSecret = "0123456789abcdef0123456789abcdef";
const exactIdentity = {
  service: "iburo127",
  environment: "preview",
  branch: VERCEL_STAGING_BRANCH,
  commitSha: confirmedCommitSha,
  runtimeTarget: "staging",
  backendEnabled: true,
};
let edgeProbeCount = 0;
const edgeValidationFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  edgeProbeCount += 1;
  assert.equal(
    String(input),
    "https://iburo127-test-deployment.vercel.app/_iburo/staging-identity",
  );
  assert.equal(init?.method, "GET");
  assert.equal(init?.cache, "no-store");
  assert.equal(init?.redirect, "manual");
  const headers = new Headers(init?.headers);
  if (headers.get("x-vercel-protection-bypass") !== automationSecret) {
    return new Response(null, { status: 403 });
  }
  return Response.json(exactIdentity);
}) as typeof fetch;

edgeProbeCount = 0;
assert.equal(
  await isAuthorizedVercelAutomationRequest(request("POST"), confirmedPreviewEnv, edgeValidationFetch),
  false,
);
assert.equal(edgeProbeCount, 0, "missing application control credential must fail before network access");

edgeProbeCount = 0;
assert.equal(
  await isAuthorizedVercelAutomationRequest(
    request("POST", { automationBypass: "fedcba9876543210fedcba9876543210" }),
    confirmedPreviewEnv,
    edgeValidationFetch,
  ),
  false,
);
assert.equal(edgeProbeCount, 1, "invalid control credential must be rejected by Vercel edge proof");

edgeProbeCount = 0;
assert.equal(
  await isAuthorizedVercelAutomationRequest(
    request("POST", { automationBypass: automationSecret }),
    confirmedPreviewEnv,
    edgeValidationFetch,
  ),
  true,
);
assert.equal(edgeProbeCount, 1, "valid control credential must be proven against the exact deployment");

assert.equal(
  await isAuthorizedVercelAutomationRequest(
    request("POST", { automationBypass: automationSecret }),
    { ...confirmedPreviewEnv, VERCEL_URL: undefined },
    edgeValidationFetch,
  ),
  false,
  "staging control must fail closed without an exact Vercel deployment URL",
);
assert.equal(
  await isAuthorizedVercelAutomationRequest(
    request("POST", { automationBypass: automationSecret }),
    { ...confirmedPreviewEnv, VERCEL_URL: "evil.example" },
    edgeValidationFetch,
  ),
  false,
  "staging control proof must never probe a non-Vercel host",
);
assert.equal(
  await isAuthorizedVercelAutomationRequest(
    request("POST", { automationBypass: automationSecret }),
    { ...confirmedPreviewEnv, VERCEL_ENV: "production" },
    edgeValidationFetch,
  ),
  false,
  "staging control proof must be unavailable outside Preview",
);
assert.equal(
  await isAuthorizedVercelAutomationRequest(
    request("POST", { automationBypass: automationSecret }),
    confirmedPreviewEnv,
    (async () => Response.json({ ...exactIdentity, commitSha: "22a4155acd473838b3e4f48bc318016187854a68" })) as typeof fetch,
  ),
  false,
  "edge proof must be bound to the exact deployed commit",
);
assert.equal(
  await isAuthorizedVercelAutomationRequest(
    request("POST", { automationBypass: automationSecret }),
    confirmedPreviewEnv,
    (async () => {
      throw new Error("network unavailable");
    }) as typeof fetch,
  ),
  false,
  "edge proof network failures must fail closed",
);

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
  evaluatePlatformMutationOrigin(request("POST", { userAgent: "node" }), productionEnv),
  {
    allowed: false,
    status: 403,
    code: PLATFORM_MUTATION_ORIGIN_REJECTED,
  },
  "spoofed Node user agent must not bypass production origin enforcement",
);

assert.deepEqual(
  evaluatePlatformMutationOrigin(
    request("POST", { userAgent: "node" }),
    confirmedPreviewEnv,
  ),
  { allowed: true },
  "repository Node verifier remains compatible on the confirmed staging Preview",
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
    VERCEL_GIT_COMMIT_SHA: confirmedCommitSha,
    IB_RUNTIME_TARGET: "staging",
    IB_VERCEL_PREVIEW_BACKEND_CONFIRM: VERCEL_STAGING_CONFIRMATION,
  },
  {
    VERCEL_ENV: "preview",
    VERCEL_GIT_COMMIT_REF: VERCEL_STAGING_BRANCH,
    VERCEL_GIT_COMMIT_SHA: confirmedCommitSha,
    IB_RUNTIME_TARGET: "production",
    IB_VERCEL_PREVIEW_BACKEND_CONFIRM: VERCEL_STAGING_CONFIRMATION,
  },
  {
    VERCEL_ENV: "preview",
    VERCEL_GIT_COMMIT_REF: VERCEL_STAGING_BRANCH,
    VERCEL_GIT_COMMIT_SHA: "not-a-valid-sha",
    IB_RUNTIME_TARGET: "staging",
    IB_VERCEL_PREVIEW_BACKEND_CONFIRM: VERCEL_STAGING_CONFIRMATION,
  },
]) {
  assert.equal(isVercelPreviewBackendAllowed(previewEnv), false);
  assert.throws(
    () => assertVercelPreviewBackendAllowed(previewEnv),
    new RegExp(VERCEL_PREVIEW_BOUNDARY_ERROR),
  );
}

assert.equal(isVercelPreviewBackendAllowed(confirmedPreviewEnv), true);
assert.doesNotThrow(() => assertVercelPreviewBackendAllowed(confirmedPreviewEnv));

const legacyConfirmationFieldIsIgnored = {
  ...confirmedPreviewEnv,
  IB_VERCEL_PREVIEW_BACKEND_CONFIRM: "STAGING:audit/production-readiness:legacy",
};
assert.equal(isVercelPreviewBackendAllowed(legacyConfirmationFieldIsIgnored), true);
assert.doesNotThrow(() => assertVercelPreviewBackendAllowed(legacyConfirmationFieldIsIgnored));

const foreignRepository = {
  ...confirmedPreviewEnv,
  VERCEL_GIT_REPO_ID: "1",
};
assert.equal(isVercelPreviewBackendAllowed(foreignRepository), false);
assert.throws(
  () => assertVercelPreviewBackendAllowed(foreignRepository),
  new RegExp(VERCEL_PREVIEW_BOUNDARY_ERROR),
);

const anotherValidShaPreview = {
  ...confirmedPreviewEnv,
  VERCEL_GIT_COMMIT_SHA: "22a4155acd473838b3e4f48bc318016187854a68",
};
assert.equal(isVercelPreviewBackendAllowed(anotherValidShaPreview), true);
assert.doesNotThrow(() => assertVercelPreviewBackendAllowed(anotherValidShaPreview));

const proxySource = await readFile(resolve("proxy.ts"), "utf8");
assert.match(proxySource, /isVercelPreviewBackendAllowed\(\)/);
assert.match(proxySource, /evaluatePlatformMutationOrigin\(request\)/);
assert.match(proxySource, /await isAuthorizedVercelAutomationRequest\(request\)/);
assert.match(proxySource, /request\.nextUrl\.pathname\.startsWith\("\/_iburo\/"\)/);
assert.match(proxySource, /SAFE_METHODS = new Set\(\["GET", "HEAD", "OPTIONS"\]\)/);
assert.match(
  proxySource,
  /SECURITY_PATH_PREFIXES = \["\/app", "\/portal", "\/auth", "\/api", "\/_iburo"\] as const/,
  "manual trailing-slash handling must keep the existing security namespaces explicit",
);
assert.match(
  proxySource,
  /matcher:\s*\["\/\(\(\?!_next\/static\|_next\/image\)\.\*\)"\]/,
  "proxy must observe non-static routes when framework trailing-slash redirects are disabled",
);
assert.match(proxySource, /Cache-Control": "private, no-store"/);
assert.match(proxySource, /STAGING_BACKEND_DISABLED/);
assert.match(proxySource, /STAGING_CONTROL_UNAVAILABLE/);
assert.doesNotMatch(proxySource, /STAGING_CONTROL_AUTH_REJECTED/);
const stagingControlAuthIndex = proxySource.indexOf("await isAuthorizedVercelAutomationRequest(request)");
const platformOriginIndex = proxySource.indexOf("evaluatePlatformMutationOrigin(request)");
assert.ok(stagingControlAuthIndex >= 0, "staging control mutation authorization must exist");
assert.ok(
  stagingControlAuthIndex < platformOriginIndex,
  "staging control-plane authorization must run before ordinary platform mutation handling",
);
assert.doesNotMatch(proxySource, /\/api\/auth/);
assert.doesNotMatch(proxySource, /\/api\/internal/);

const automationAuthSource = await readFile(
  resolve("server/staging/vercel-automation-auth.ts"),
  "utf8",
);
assert.match(automationAuthSource, /VERCEL_URL/);
assert.match(automationAuthSource, /x-vercel-protection-bypass/);
assert.match(automationAuthSource, /_iburo\/staging-identity/);
assert.match(automationAuthSource, /cache: "no-store"/);
assert.match(automationAuthSource, /redirect: "manual"/);
assert.match(automationAuthSource, /AbortController/);
assert.doesNotMatch(
  automationAuthSource,
  /env\.VERCEL_AUTOMATION_BYPASS_SECRET/,
  "application control authorization must validate the provided credential against Vercel edge rather than a potentially drifted runtime copy",
);

const stagingBypassSource = await readFile(
  resolve("scripts/staging-vercel-protection-bypass.mjs"),
  "utf8",
);
assert.match(stagingBypassSource, /headers\.set\("x-vercel-protection-bypass", secret\)/);
assert.match(stagingBypassSource, /STAGING_CONTROL_PATH_PREFIX = "\/_iburo\/"/);
assert.match(stagingBypassSource, /STAGING_CONTROL_HEADER = "x-iburo-staging-control"/);
const unsafeMethodIndex = stagingBypassSource.indexOf("!SAFE_METHODS.has(request.method.toUpperCase())");
const stagingControlPathIndex = stagingBypassSource.indexOf(
  "requestUrl.pathname.startsWith(STAGING_CONTROL_PATH_PREFIX)",
);
const stagingControlHeaderIndex = stagingBypassSource.indexOf(
  "headers.set(STAGING_CONTROL_HEADER, secret)",
);
assert.ok(unsafeMethodIndex >= 0, "staging fetch wrapper must distinguish unsafe methods");
assert.ok(
  unsafeMethodIndex < stagingControlPathIndex && stagingControlPathIndex < stagingControlHeaderIndex,
  "the application control credential must be forwarded only inside unsafe same-origin /_iburo requests",
);

const workflowMutationContracts = [
  [".github/workflows/staging-application-e2e.yml", "/_iburo/staging-client-plan-auth-fixtures"],
  [".github/workflows/staging-application-e2e.yml", "/_iburo/staging-application-e2e-fixtures"],
  [".github/workflows/staging-external-readiness.yml", "/_iburo/staging-file-scan-fixture-cleanup"],
  [".github/workflows/staging-external-readiness.yml", "/_iburo/staging-maintenance-health"],
  [".github/workflows/staging-external-readiness.yml", "/_iburo/staging-storage-verify"],
  [".github/workflows/staging-yandex-ai-smoke.yml", "/_iburo/staging-ai-verify"],
  [".github/workflows/staging-better-auth-173-upgrade.yml", "/_iburo/staging-better-auth-upgrade-173"],
] as const;
for (const [workflowPath, route] of workflowMutationContracts) {
  const workflowSource = await readFile(resolve(workflowPath), "utf8");
  const escapedRoute = route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const protectedMutation = new RegExp(
    `(?:-X POST|--request POST)[\\s\\S]{0,700}x-vercel-protection-bypass: \\$VERCEL_AUTOMATION_BYPASS_SECRET[\\s\\S]{0,300}x-iburo-staging-control: \\$VERCEL_AUTOMATION_BYPASS_SECRET[\\s\\S]{0,900}${escapedRoute}`,
  );
  assert.match(
    workflowSource,
    protectedMutation,
    `${workflowPath} must forward the separate application control credential for ${route}`,
  );
}

const portalLayoutSource = await readFile(resolve("app/portal/layout.tsx"), "utf8");
assert.match(portalLayoutSource, /resolveProductionStaffMfaState\(\)/);
const mfaEnrollSource = await readFile(resolve("app/auth/mfa-enroll/page.tsx"), "utf8");
assert.match(mfaEnrollSource, /resolveProductionStaffMfaState\(\)/);

const stagingIdentitySource = await readFile(
  resolve("app/%5Fiburo/staging-identity/route.ts"),
  "utf8",
);
assert.match(stagingIdentitySource, /VERCEL_GIT_COMMIT_SHA/);
assert.match(stagingIdentitySource, /VERCEL_GIT_COMMIT_REF/);
assert.match(stagingIdentitySource, /IB_RUNTIME_TARGET/);
assert.match(stagingIdentitySource, /isVercelPreviewBackendAllowed/);
assert.match(stagingIdentitySource, /Cache-Control": "private, no-store, max-age=0"/);
assert.match(stagingIdentitySource, /X-Content-Type-Options": "nosniff"/);
for (const forbidden of [
  "DATABASE_URL",
  "BETTER_AUTH_SECRET",
  "OPENAI_API_KEY",
  "YANDEX_STORAGE_SECRET_ACCESS_KEY",
  "YANDEX_POSTBOX_SECRET_ACCESS_KEY",
  "IB_FILE_SCANNER_SECRET",
  "IB_MAINTENANCE_SECRET",
  "BITRIX24_WEBHOOK_URL",
]) {
  assert.doesNotMatch(
    stagingIdentitySource,
    new RegExp(forbidden),
    `${forbidden} must not be exposed by staging identity`,
  );
}

console.log("PLATFORM_MUTATION_ORIGIN_TEST_PASS");
