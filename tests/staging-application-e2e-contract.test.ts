import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  evaluateStagingAuthFlowGuard,
  generateTotp,
  StagingCookieJar,
} from "../scripts/staging-auth-flow-core";
import {
  requireStagingHttpTarget,
  STAGING_HTTP_TARGET_GUARD,
} from "../scripts/staging-http-target-guard";
import {
  isVercelPreviewBackendAllowed,
  VERCEL_STAGING_CONFIRMATION,
} from "../server/config/vercel-preview-boundary";

const previewCommitSha = "a".repeat(40);
const previewBoundaryEnv = {
  VERCEL_ENV: "preview",
  VERCEL_GIT_COMMIT_REF: "audit/production-readiness",
  VERCEL_GIT_COMMIT_SHA: previewCommitSha,
  IB_RUNTIME_TARGET: "staging",
  IB_VERCEL_PREVIEW_BACKEND_CONFIRM: VERCEL_STAGING_CONFIRMATION,
};
assert.equal(
  isVercelPreviewBackendAllowed(previewBoundaryEnv),
  true,
  "Preview backend confirmation must be stable for the staging branch and must not require manual SHA rebinding",
);
assert.equal(
  isVercelPreviewBackendAllowed({
    ...previewBoundaryEnv,
    IB_VERCEL_PREVIEW_BACKEND_CONFIRM: `${VERCEL_STAGING_CONFIRMATION}:${previewCommitSha}`,
  }),
  false,
  "legacy SHA-bound Preview confirmation must not become the active contract again",
);
assert.equal(
  isVercelPreviewBackendAllowed({ ...previewBoundaryEnv, VERCEL_GIT_COMMIT_SHA: "not-a-sha" }),
  false,
  "Preview backend must still require a valid Vercel commit SHA",
);
assert.equal(
  isVercelPreviewBackendAllowed({ ...previewBoundaryEnv, VERCEL_GIT_COMMIT_REF: "main" }),
  false,
  "Preview backend must remain restricted to the staging branch",
);
assert.equal(
  isVercelPreviewBackendAllowed({ ...previewBoundaryEnv, IB_RUNTIME_TARGET: "production" }),
  false,
  "Preview backend must remain restricted to the staging runtime target",
);

const rfcSecret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
assert.equal(generateTotp(rfcSecret, { timestampMs: 59_000, digits: 8 }), "94287082");
assert.equal(generateTotp(rfcSecret, { timestampMs: 59_000, digits: 6 }), "287082");
assert.throws(() => generateTotp("not-base32!"), /INVALID_TOTP_SECRET/);

assert.deepEqual(
  evaluateStagingAuthFlowGuard({
    runtimeTarget: "staging",
    authFlowTarget: "staging",
    confirmation: "AUTH-FLOW:stage.iburo.invalid",
    host: "stage.iburo.invalid",
  }),
  { allowed: true, code: "ALLOWED" },
);
assert.equal(
  evaluateStagingAuthFlowGuard({
    runtimeTarget: "production",
    authFlowTarget: "staging",
    confirmation: "AUTH-FLOW:stage.iburo.invalid",
    host: "stage.iburo.invalid",
  }).allowed,
  false,
);
assert.equal(
  evaluateStagingAuthFlowGuard({
    runtimeTarget: "staging",
    authFlowTarget: "production",
    confirmation: "AUTH-FLOW:stage.iburo.invalid",
    host: "stage.iburo.invalid",
  }).allowed,
  false,
);
assert.equal(
  evaluateStagingAuthFlowGuard({
    runtimeTarget: "staging",
    authFlowTarget: "staging",
    confirmation: "AUTH-FLOW:wrong.invalid",
    host: "stage.iburo.invalid",
  }).allowed,
  false,
);
for (const host of [
  "iburo127.ru",
  "www.iburo127.ru",
  "api.iburo127.ru",
  "API.IBURO127.RU.",
  "api.iburo127.ru:443",
]) {
  assert.deepEqual(
    evaluateStagingAuthFlowGuard({
      runtimeTarget: "staging",
      authFlowTarget: "staging",
      confirmation: `AUTH-FLOW:${host}`,
      host,
    }),
    { allowed: false, code: "PRODUCTION_HOST_BLOCKED" },
    `auth-flow guard must reject production host ${host}`,
  );
}

assert.equal(
  requireStagingHttpTarget({
    IB_RUNTIME_TARGET: "staging",
    IB_STAGING_BASE_URL: "https://preview.example.vercel.app",
  }).origin,
  "https://preview.example.vercel.app",
);
assert.equal(
  requireStagingHttpTarget({
    IB_RUNTIME_TARGET: "staging",
    IB_STAGING_BASE_URL: "http://127.0.0.1:3000",
  }).origin,
  "http://127.0.0.1:3000",
);
for (const env of [
  { IB_STAGING_BASE_URL: "https://preview.example.vercel.app" },
  { IB_RUNTIME_TARGET: "production", IB_STAGING_BASE_URL: "https://preview.example.vercel.app" },
  { IB_RUNTIME_TARGET: "staging", IB_STAGING_BASE_URL: "https://iburo127.ru" },
  { IB_RUNTIME_TARGET: "staging", IB_STAGING_BASE_URL: "https://www.iburo127.ru" },
  { IB_RUNTIME_TARGET: "staging", IB_STAGING_BASE_URL: "https://api.iburo127.ru" },
  { IB_RUNTIME_TARGET: "staging", IB_STAGING_BASE_URL: "https://IBURO127.RU." },
  { IB_RUNTIME_TARGET: "staging", IB_STAGING_BASE_URL: "https://preview.example.vercel.app/path" },
  { IB_RUNTIME_TARGET: "staging", IB_STAGING_BASE_URL: "https://preview.example.vercel.app?x=1" },
  { IB_RUNTIME_TARGET: "staging", IB_STAGING_BASE_URL: "https://user:pass@preview.example.vercel.app" },
  { IB_RUNTIME_TARGET: "staging", IB_STAGING_BASE_URL: "http://preview.example.com" },
]) {
  assert.throws(
    () => requireStagingHttpTarget(env),
    (error: unknown) =>
      error instanceof Error &&
      error.message.startsWith(`${STAGING_HTTP_TARGET_GUARD}:`),
  );
}

const jar = new StagingCookieJar();
jar.absorbSetCookieLines([
  "session=alpha==; Path=/; HttpOnly; Secure",
  "two_factor=beta; Path=/; Max-Age=300; HttpOnly",
]);
assert.equal(jar.header(), "session=alpha==; two_factor=beta");
jar.absorbSetCookieLines(["session=; Path=/; Max-Age=0"]);
assert.equal(jar.header(), "two_factor=beta");
jar.clear();
assert.equal(jar.hasCookies, false);

const packageJson = JSON.parse(await readFile(resolve("package.json"), "utf8")) as {
  scripts?: Record<string, string>;
};
const sessionSource = await readFile(resolve("scripts/staging-authenticated-sessions.ts"), "utf8");
const orchestratorSource = await readFile(resolve("scripts/verify-staging-application-e2e.ts"), "utf8");
const httpAuthzSource = await readFile(resolve("scripts/verify-staging-http-authz.ts"), "utf8");
const aiHttpAuthzSource = await readFile(resolve("scripts/verify-staging-ai-http-authz.ts"), "utf8");

assert.equal(
  packageJson.scripts?.["check:staging:auth-flow"],
  "tsx scripts/verify-staging-auth-flow.ts",
  "staging auth flow must keep a dedicated entrypoint",
);
assert.equal(
  packageJson.scripts?.["check:staging:application-e2e"],
  "tsx scripts/verify-staging-application-e2e.ts",
  "active staging application E2E must use the fresh-session orchestrator",
);

const orderedVerifierPaths = [
  "scripts/verify-staging-http-authz.ts",
  "scripts/verify-staging-ai-http-authz.ts",
  "scripts/verify-staging-http-mutation-audit.ts",
] as const;
let previousIndex = -1;
for (const path of orderedVerifierPaths) {
  const index = orchestratorSource.indexOf(path);
  assert.ok(index > previousIndex, `${path} must remain in the reviewed E2E order`);
  previousIndex = index;
}

for (const [label, source] of [
  ["HTTP authorization", httpAuthzSource],
  ["AI HTTP authorization", aiHttpAuthzSource],
] as const) {
  const guardIndex = source.indexOf("requireStagingHttpTarget(process.env)");
  const fetchIndex = source.indexOf("fetch(");
  assert.ok(guardIndex >= 0, `${label} must invoke the shared staging HTTP target guard`);
  assert.ok(fetchIndex > guardIndex, `${label} must validate the staging target before first fetch`);
  assert.match(source, /STAGING_HTTP_TARGET_GUARD/);
}

assert.match(orchestratorSource, /createStagingAuthenticatedSessions/);
assert.match(orchestratorSource, /STAGING_SESSION_COOKIE_ENV_NAMES/);
assert.match(orchestratorSource, /spawn\(\s*process\.execPath/);
assert.match(orchestratorSource, /\["--import", "tsx", scriptPath\]/);
assert.match(orchestratorSource, /stdio:\s*"inherit"/);
assert.match(orchestratorSource, /shell:\s*false/);
assert.match(orchestratorSource, /finally\s*\{/);
assert.match(orchestratorSource, /sessions\.cleanup\(\{ strict: true \}\)/);
assert.match(
  orchestratorSource,
  /refuses pre-supplied CLIENT\/OTHER_CLIENT\/LAWYER\/MANAGER cookies/,
  "active E2E must reject operator-supplied session cookies, including OTHER_CLIENT",
);
assert.match(orchestratorSource, /IB_STAGING_OTHER_CLIENT_COOKIE/);
assert.doesNotMatch(orchestratorSource, /writeFile|appendFile|fs\/promises/);
assert.doesNotMatch(
  orchestratorSource,
  /process\.env\.IB_STAGING_(?:CLIENT|LAWYER|MANAGER)_COOKIE\s*=/,
  "parent orchestrator must not write fresh session cookies into its own process.env",
);

const sessionFactoryIndex = sessionSource.indexOf("export async function createStagingAuthenticatedSessions");
const authFlowGuardIndex = sessionSource.indexOf("evaluateStagingAuthFlowGuard({", sessionFactoryIndex);
const firstAnonymousNetworkPathIndex = sessionSource.indexOf("await requirePlatformUnauthenticated(", authFlowGuardIndex);
assert.ok(sessionFactoryIndex >= 0, "staging session bootstrap factory must exist");
assert.ok(authFlowGuardIndex > sessionFactoryIndex, "staging session bootstrap must evaluate auth-flow guard");
assert.ok(
  firstAnonymousNetworkPathIndex > authFlowGuardIndex,
  "auth-flow target guard must reject unsafe execution before the first anonymous network path",
);

assert.match(sessionSource, /"\/api\/public\/access-gate"/);
assert.match(sessionSource, /"\/api\/public\/access-gate\/sign-in"/);
assert.match(sessionSource, /access gate did not issue an opaque login challenge/);
assert.doesNotMatch(
  sessionSource,
  /"\/api\/auth\/sign-in\/email"/,
  "fresh staging sessions must not bypass the production access gate",
);
assert.match(sessionSource, /trustDevice:\s*false/);
assert.match(sessionSource, /iburo127\.ru/);
assert.match(sessionSource, /\/api\/auth\/sign-out/);
assert.match(sessionSource, /StagingCookieJar/);
assert.match(sessionSource, /env\.IB_STAGING_FILES_E2E\?\.trim\(\) === "1"/);
assert.match(sessionSource, /readFixture\(env, "OTHER_CLIENT", "OTHER_CLIENT", "CLIENT", false\)/);
assert.match(sessionSource, /OTHER_CLIENT staging fixture must be a dedicated account distinct from CLIENT/);
assert.match(sessionSource, /OTHER_CLIENT: otherClientJar\.header\(\)/);
assert.match(sessionSource, /const otherClientJar = jars\.get\("OTHER_CLIENT"\)/);
assert.match(sessionSource, /for \(const jar of jars\.values\(\)\)/);
assert.doesNotMatch(sessionSource, /writeFile|appendFile|fs\/promises/);
assert.doesNotMatch(
  sessionSource,
  /console\.(?:log|error)\([^\n]*(?:cookie|password|totpSecret|challenge)/i,
  "session bootstrap must not log authentication material",
);

const workflowSource = await readFile(resolve(".github/workflows/staging-application-e2e.yml"), "utf8");
const fixtureResetSource = await readFile(
  resolve("app/%5Fiburo/staging-application-e2e-fixtures/route.ts"),
  "utf8",
);
assert.match(workflowSource, /IB_STAGING_OTHER_CLIENT_EMAIL:\s*client\.lite@example\.test/);
assert.match(workflowSource, /IB_STAGING_OTHER_CLIENT_PASSWORD:\s*\$\{\{ secrets\.IB_STAGING_CLIENT_PASSWORD \}\}/);
assert.doesNotMatch(workflowSource, /secrets\.IB_STAGING_OTHER_CLIENT_(?:EMAIL|PASSWORD)/);
assert.match(workflowSource, /IB_STAGING_FILES_E2E: "1"/);
assert.match(workflowSource, /IB_STAGING_FILE_SCAN_E2E: "0"/);
assert.match(
  workflowSource,
  /IB_STAGING_PRIVATE_BUCKET_CONFIRM:\s*PRIVATE_STAGING_BUCKET:iburo127-app-git-audit-pr-0d0d70-misterio712rino-9166s-projects\.vercel\.app/,
);

assert.match(fixtureResetSource, /const FILES_E2E_FIXTURE_NAME = "iburo-staging-e2e\.pdf"/);
assert.match(fixtureResetSource, /const MAX_FILES_E2E_FIXTURES = 4/);
assert.match(fixtureResetSource, /const filesE2eEnabled = env\.IB_STAGING_FILES_E2E\?\.trim\(\) === "1"/);
assert.match(fixtureResetSource, /isPrivateStagingBucketConfirmed\(request, env\)/);
assert.match(fixtureResetSource, /PRIVATE_STAGING_BUCKET:\$\{new URL\(request\.url\)\.host\}/);
assert.match(fixtureResetSource, /getPrivateObjectStorage/);
assert.match(fixtureResetSource, /clientCaseId: input\.clientCaseId/);
assert.match(fixtureResetSource, /uploadedById: input\.clientId/);
assert.match(fixtureResetSource, /fileName: FILES_E2E_FIXTURE_NAME/);
assert.match(fixtureResetSource, /mimeType: FILES_E2E_FIXTURE_MIME_TYPE/);
assert.match(fixtureResetSource, /objectKeyPrefix = `cases\/\$\{input\.clientCaseId\}\//);
assert.match(fixtureResetSource, /await storage\.statObject\(file\.objectKey\)/);
assert.match(fixtureResetSource, /await storage\.deleteObject\(file\.objectKey\)/);
assert.match(fixtureResetSource, /if \(deleted\.count !== 1\)/);
assert.match(fixtureResetSource, /failureStage = "fixture-cleanup"/);
assert.doesNotMatch(
  fixtureResetSource,
  /storedFile\.deleteMany\(\s*\{\s*\}\s*\)/,
  "files E2E reset must never perform a broad StoredFile delete",
);

for (const forbidden of [
  "db:deploy:staging",
  "check:staging:email-delivery",
  "check:staging:ai-provider",
  "check:staging:file-scanner",
  "check:staging:storage",
]) {
  assert.ok(
    !orchestratorSource.includes(forbidden),
    `active application E2E must not silently execute separately guarded external operation ${forbidden}`,
  );
}

const mutationAudit = packageJson.scripts?.["check:staging:http-mutations:audit"] ?? "";
assert.ok(
  mutationAudit.startsWith("npm run check:staging:http-mutation-preflight &&"),
  "standalone mutation+audit entrypoint must remain protected by the network-free mutation preflight",
);

console.log("STAGING_APPLICATION_E2E_CONTRACT_PASS");
