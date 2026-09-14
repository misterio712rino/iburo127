import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { normalizeCourtCaseNumber } from "../lib/platform/client-case-number";
import { getManualTrailingSlashRedirectPath } from "../server/http/trailing-slash-policy";

async function collectFiles(
  directory: string,
  include: (fileName: string) => boolean,
): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(path, include)));
    } else if (entry.isFile() && include(entry.name)) {
      files.push(path);
    }
  }
  return files;
}

const platformRoutes = await collectFiles(
  resolve("app/api/platform"),
  (name) => name === "route.ts",
);
const routeAdapters = await collectFiles(
  resolve("server"),
  (name) => name === "route-adapter.ts",
);
const inspectedFiles = [...platformRoutes, ...routeAdapters];
assert.ok(platformRoutes.length > 0, "platform route inventory must not be empty");
assert.ok(routeAdapters.length > 0, "route-adapter inventory must not be empty");

const forbiddenDirectResponses: Array<[RegExp, string]> = [
  [/\bResponse\.json\s*\(/, "Response.json"],
  [/\bNextResponse\.json\s*\(/, "NextResponse.json"],
  [/\bNextResponse\.redirect\s*\(/, "NextResponse.redirect"],
  [/\bnew\s+Response\s*\(/, "new Response"],
];

const forbiddenExceptionPayloads: Array<[RegExp, string]> = [
  [/\berror\.stack\b/, "error.stack"],
  [/\bString\s*\(\s*error\s*\)/, "String(error)"],
  [/\b(?:message|code|error|detail|details|reason)\s*:\s*error\.message\b/, "raw error.message response field"],
  [/\b(?:message|code|error|detail|details|reason)\s*:\s*error\.stack\b/, "raw error.stack response field"],
];

for (const file of inspectedFiles) {
  const source = await readFile(file, "utf8");
  for (const [pattern, label] of forbiddenDirectResponses) {
    assert.doesNotMatch(
      source,
      pattern,
      `${file} must not use ${label}; authenticated platform routes/adapters must return through the shared private transport boundary`,
    );
  }
  for (const [pattern, label] of forbiddenExceptionPayloads) {
    assert.doesNotMatch(
      source,
      pattern,
      `${file} must not expose ${label}; map exceptions to reviewed stable error codes instead`,
    );
  }
  assert.doesNotMatch(
    source,
    /\bCache-Control\b[\s\S]{0,80}\bpublic\b/i,
    `${file} must not declare public cache semantics`,
  );
  assert.doesNotMatch(
    source,
    /\bs-maxage\b/i,
    `${file} must not declare shared-cache s-maxage`,
  );
}

const helper = await readFile(resolve("server/http/private-json.ts"), "utf8");
assert.match(helper, /"Cache-Control":\s*"private, no-store, max-age=0"/);
assert.match(helper, /Pragma:\s*"no-cache"/);
assert.match(helper, /"X-Content-Type-Options":\s*"nosniff"/);
assert.match(helper, /Response\.json\(body/);

const clientCaseTransport = await readFile(resolve("server/client-cases/transport.ts"), "utf8");
assert.match(
  clientCaseTransport,
  /caseNumber:\s*normalizeCourtCaseNumber\(clientCase\.caseNumber\)\s*\?\?\s*"Номер дела ещё не присвоен"/,
  "platform case transport must mask internal/non-court case numbers before returning authenticated JSON",
);
assert.doesNotMatch(
  clientCaseTransport,
  /caseNumber:\s*clientCase\.caseNumber/,
  "platform case transport must not serialize raw case numbers",
);
assert.equal(normalizeCourtCaseNumber("IB-2026-0001"), null);
assert.equal(normalizeCourtCaseNumber("IBR-2026-0001"), null);
assert.equal(normalizeCourtCaseNumber("A40-12345/2026"), "А40-12345/2026");
assert.equal(normalizeCourtCaseNumber("А40-12345/2026"), "А40-12345/2026");

assert.equal(
  getManualTrailingSlashRedirectPath("/api/auth/sign-in/email/"),
  null,
  "Better Auth trailing-slash paths must reach the route handler instead of an early framework redirect",
);
assert.equal(getManualTrailingSlashRedirectPath("/api/auth/"), null);
assert.equal(getManualTrailingSlashRedirectPath("/api/auth/sign-in/email"), null);
assert.equal(getManualTrailingSlashRedirectPath("/auth/login/"), "/auth/login");
assert.equal(getManualTrailingSlashRedirectPath("/portal/"), "/portal");
assert.equal(getManualTrailingSlashRedirectPath("/api/platform/cases/"), "/api/platform/cases");
assert.equal(getManualTrailingSlashRedirectPath("/contacts/"), "/contacts");
assert.equal(getManualTrailingSlashRedirectPath("/"), null);

const nextConfigSource = await readFile(resolve("next.config.ts"), "utf8");
assert.match(
  nextConfigSource,
  /skipTrailingSlashRedirect:\s*true/,
  "Next framework trailing-slash redirect must stay disabled so private auth slash variants reach the reviewed route boundary",
);

const proxySource = await readFile(resolve("proxy.ts"), "utf8");
assert.match(proxySource, /getManualTrailingSlashRedirectPath\(request\.nextUrl\.pathname\)/);
assert.match(proxySource, /new URL\(request\.url\)/);
assert.match(proxySource, /NextResponse\.redirect\(canonicalUrl, 308\)/);
assert.match(proxySource, /matcher:\s*\["\/\(\(\?!_next\/static\|_next\/image\)\.\*\)"\]/);

const authRouteSource = await readFile(resolve("app/api/auth/[...all]/route.ts"), "utf8");
assert.match(authRouteSource, /canonicalizeAuthPath/);
assert.match(authRouteSource, /ACCESS_GATE_ONLY_PATHS = new Set\(\["\/api\/auth\/sign-in\/email"\]\)/);
assert.match(authRouteSource, /privateJsonResponse\([\s\S]*ACCESS_GATE_REQUIRED[\s\S]*404/);

const stagingBypassSource = await readFile(
  resolve("scripts/staging-vercel-protection-bypass.mjs"),
  "utf8",
);
const crossOriginGuardIndex = stagingBypassSource.indexOf(
  "if (requestUrl.origin !== targetOrigin)",
);
const vercelBypassHeaderIndex = stagingBypassSource.indexOf(
  'headers.set("x-vercel-protection-bypass", secret)',
);
const mutationOriginIndex = stagingBypassSource.indexOf('headers.set("origin", targetOrigin)');
const stagingControlHeaderIndex = stagingBypassSource.indexOf(
  "headers.set(STAGING_CONTROL_HEADER, secret)",
);
assert.ok(
  crossOriginGuardIndex >= 0 && crossOriginGuardIndex < vercelBypassHeaderIndex,
  "staging credentials must never be attached before the cross-origin guard",
);
assert.match(
  stagingBypassSource,
  /hostname === "iburo127\.ru" \|\| hostname\.endsWith\("\.iburo127\.ru"\)/,
  "production hostname must remain blocked by the staging wrapper",
);
assert.match(stagingBypassSource, /STAGING_CONTROL_HEADER = "x-iburo-staging-control"/);
assert.ok(
  mutationOriginIndex >= 0 && mutationOriginIndex < stagingControlHeaderIndex,
  "unsafe staging-control requests must set their exact staging Origin before the application credential",
);
assert.match(stagingBypassSource, /headers\.set\("sec-fetch-site", "same-origin"\)/);

console.log(
  `PLATFORM_PRIVATE_RESPONSE_BOUNDARY_PASS: ${inspectedFiles.length} route/adapter file(s) inspected`,
);
