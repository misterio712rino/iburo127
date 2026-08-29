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
] satisfies NodeJS.ProcessEnv[]) {
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
  /refuses pre-supplied CLIENT\/LAWYER\/MANAGER cookies/,
  "active E2E must reject operator-supplied core session cookies",
);
assert.doesNotMatch(orchestratorSource, /writeFile|appendFile|fs\/promises/);
assert.doesNotMatch(
  orchestratorSource,
  /process\.env\.IB_STAGING_(?:CLIENT|LAWYER|MANAGER)_COOKIE\s*=/,
  "parent orchestrator must not write fresh session cookies into its own process.env",
);

assert.match(sessionSource, /trustDevice:\s*false/);
assert.match(sessionSource, /iburo127\.ru/);
assert.match(sessionSource, /\/api\/auth\/sign-out/);
assert.match(sessionSource, /StagingCookieJar/);
assert.doesNotMatch(sessionSource, /writeFile|appendFile|fs\/promises/);
assert.doesNotMatch(
  sessionSource,
  /console\.(?:log|error)\([^\n]*(?:cookie|password|totpSecret)/i,
  "session bootstrap must not log authentication material",
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
