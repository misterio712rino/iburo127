import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const stagingRoot = resolve("app/%5Fiburo");
const expectedRoutes = [
  "staging-ai-verify",
  "staging-application-e2e-fixtures",
  "staging-auth-config",
  "staging-auth-fixtures",
  "staging-better-auth-migrate",
  "staging-better-auth-upgrade-173",
  "staging-better-auth-verify",
  "staging-client-plan-auth-fixtures",
  "staging-db-baseline",
  "staging-domain-fixtures",
  "staging-external-readiness",
  "staging-file-deletion-worker",
  "staging-file-scan-backlog-classifier",
  "staging-file-scan-fixture-cleanup",
  "staging-identity",
  "staging-maintenance-health",
  "staging-postbox-verify",
  "staging-scanner-bridge",
  "staging-scanner-fixture-url",
  "staging-storage-verify",
] as const;

const routeDirectories = (await readdir(stagingRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

assert.deepEqual(
  routeDirectories,
  [...expectedRoutes].sort(),
  "staging internal route inventory must remain explicit so every new /_iburo endpoint receives an audited exact-Preview boundary",
);

for (const routeName of expectedRoutes) {
  const source = await readFile(resolve(stagingRoot, routeName, "route.ts"), "utf8");

  assert.match(source, /export const dynamic = "force-dynamic";/, `${routeName} must stay dynamic`);
  assert.match(
    source,
    /Cache-Control": "private, no-store, max-age=0"/,
    `${routeName} responses must remain private and no-store`,
  );
  assert.match(
    source,
    /function isExactStagingPreview\(env: NodeJS\.ProcessEnv\)/,
    `${routeName} must define an exact staging Preview boundary`,
  );
  assert.match(source, /env\.VERCEL_ENV\?\.trim\(\) === "preview"/, `${routeName} must require Vercel Preview`);
  assert.match(
    source,
    /env\.VERCEL_GIT_COMMIT_REF\?\.trim\(\) === VERCEL_STAGING_BRANCH/,
    `${routeName} must require the audited staging branch`,
  );
  assert.match(
    source,
    /env\.IB_RUNTIME_TARGET\?\.trim\(\) === "staging"/,
    `${routeName} must require the staging runtime target`,
  );
  assert.match(source, /VERCEL_GIT_COMMIT_SHA/, `${routeName} must bind to a Vercel commit SHA`);
  assert.match(source, /\^\[a-f0-9\]\{40\}\$/i, `${routeName} must validate an exact 40-character Git SHA`);
  assert.match(
    source,
    /isVercelPreviewBackendAllowed\(env\)/,
    `${routeName} must require the configured Preview backend boundary`,
  );

  const handlerPattern = /export async function (GET|POST|PUT|PATCH|DELETE)\([^)]*\)\s*\{/g;
  const handlers = [...source.matchAll(handlerPattern)];
  assert.ok(handlers.length > 0, `${routeName} must expose at least one audited HTTP handler`);

  for (let index = 0; index < handlers.length; index += 1) {
    const match = handlers[index]!;
    const start = match.index ?? 0;
    const end = handlers[index + 1]?.index ?? source.length;
    const handler = source.slice(start, end);
    const method = match[1];

    assert.match(
      handler,
      /const env = process\.env;[\s\S]{0,500}?isExactStagingPreview\(env\)/,
      `${routeName} ${method} must enforce the exact staging Preview boundary before normal work`,
    );
    assert.match(
      handler.slice(0, 1100),
      /isExactStagingPreview\(env\)[\s\S]{0,900}?(?:status:\s*404|fail\([^\n]*404\)|unavailable\(\)|unavailable\(\s*404\s*,)/,
      `${routeName} ${method} must fail closed with 404 when the exact staging Preview boundary is not satisfied`,
    );
  }
}

const scannerFixtureRoute = await readFile(
  resolve(stagingRoot, "staging-scanner-fixture-url", "route.ts"),
  "utf8",
);
assert.match(
  scannerFixtureRoute,
  /const DIAGNOSTIC_HEADER = "X-Iburo-Staging-Scanner-Diagnostic";/,
  "scanner fixture issuer diagnostics must use one fixed staging-only response header",
);
assert.match(
  scannerFixtureRoute,
  /if \(!isExactStagingPreview\(env\)\) return unavailable\(\);/,
  "boundary failures must stay indistinguishable and must not receive a diagnostic reason",
);
for (const reason of ["ISSUER_ENV", "AUTH_HEADER", "REQUEST"]) {
  assert.match(
    scannerFixtureRoute,
    new RegExp(`return unavailable\\("${reason}"\\)`),
    `scanner fixture issuer must use only the fixed ${reason} diagnostic reason`,
  );
}
assert.match(scannerFixtureRoute, /return "OIDC";/);
assert.match(scannerFixtureRoute, /return "ISSUER";/);
assert.match(scannerFixtureRoute, /return "UPSTREAM";/);
assert.match(scannerFixtureRoute, /VERCEL_BLOB_CONFIG_ERROR/);
assert.match(scannerFixtureRoute, /VERCEL_BLOB_NATIVE_BINDING_ERROR/);
assert.match(scannerFixtureRoute, /BLOB_SIGNED_TOKEN_HTTP_/);
assert.match(scannerFixtureRoute, /return "UPSTREAM_NETWORK";/);
assert.match(
  scannerFixtureRoute,
  /headers: reason \? \{ \.\.\.HEADERS, \[DIAGNOSTIC_HEADER\]: reason \} : HEADERS/,
  "diagnostic reason must be returned only through the fixed response header",
);
assert.doesNotMatch(
  scannerFixtureRoute,
  /\bconsole\s*\./,
  "scanner fixture issuer route must not bypass the runtime logging gate",
);

const scannerBridgeRoute = await readFile(
  resolve(stagingRoot, "staging-scanner-bridge", "route.ts"),
  "utf8",
);
assert.match(scannerBridgeRoute, /const CONTROL_HEADER = "x-iburo-staging-scanner-control";/);
assert.match(
  scannerBridgeRoute,
  /const FINGERPRINT_HEADER = "x-iburo-staging-scanner-secret-sha256";/,
);
assert.match(
  scannerBridgeRoute,
  /const EXPECTED_SCANNER_ORIGIN = "https:\/\/scanner-v2-staging\.iburo127\.online";/,
);
assert.match(
  scannerBridgeRoute,
  /const DIAGNOSTIC_HEADER = "X-Iburo-Staging-Scanner-Bridge-Diagnostic";/,
  "scanner bridge diagnostics must use one fixed staging-only response header",
);
assert.match(
  scannerBridgeRoute,
  /if \(!isExactStagingPreview\(env\)\) return unavailable\(\);/,
  "scanner bridge boundary failures must stay indistinguishable",
);
for (const reason of ["CONFIG", "ORIGIN", "FINGERPRINT", "CONTROL", "REQUEST"]) {
  assert.match(
    scannerBridgeRoute,
    new RegExp(`unavailable\\(404, "${reason}"\\)`),
    `scanner bridge must use only the fixed ${reason} diagnostic reason`,
  );
}
for (const reason of [
  "UPSTREAM_NETWORK",
  "UPSTREAM_HTTP",
  "UPSTREAM_FORMAT",
  "UPSTREAM_BODY",
]) {
  assert.match(
    scannerBridgeRoute,
    new RegExp(`ScannerBridgeUpstreamError\\("${reason}"\\)`),
    `scanner bridge must classify ${reason} without exposing upstream details`,
  );
}
assert.match(scannerBridgeRoute, /error instanceof ScannerBridgeUpstreamError/);
assert.match(scannerBridgeRoute, /unavailable\(502, error\.reason\)/);
assert.match(scannerBridgeRoute, /unavailable\(502, "UPSTREAM"\)/);
assert.match(scannerBridgeRoute, /\[DIAGNOSTIC_HEADER\]: reason/);
assert.match(scannerBridgeRoute, /readFileScannerRuntimeConfig\(env\)/);
assert.match(scannerBridgeRoute, /createHash\("sha256"\)\.update\(config\.secret, "utf8"\)/);
assert.match(scannerBridgeRoute, /RUN_STAGING_SCANNER_BRIDGE:\$\{commitSha\}:\$\{fingerprint\}/);
assert.match(scannerBridgeRoute, /MAX_REQUEST_BYTES = 8 \* 1024/);
assert.match(scannerBridgeRoute, /input\.operation === "health"/);
assert.match(scannerBridgeRoute, /input\.operation !== "scan"/);
assert.match(scannerBridgeRoute, /scanWithHttpMalwareScanner\(config,/);
assert.doesNotMatch(scannerBridgeRoute, /BLOB_READ_WRITE_TOKEN|prisma|ClientCase|getPrivateObjectStorage/i);
assert.doesNotMatch(scannerBridgeRoute, /\bconsole\s*\./);

const bridgeControlIndex = scannerBridgeRoute.indexOf("expectedControl");
const bridgeRequestIndex = scannerBridgeRoute.indexOf("readBoundedRequest(request)");
assert.ok(
  bridgeControlIndex >= 0 && bridgeRequestIndex > bridgeControlIndex,
  "scanner bridge must authenticate exact commit/fingerprint control before reading the request body",
);

const postboxVerifierSource = await readFile(
  resolve(stagingRoot, "staging-postbox-verify", "route.ts"),
  "utf8",
);
assert.match(
  postboxVerifierSource,
  /const CONFIRM_HEADER = "x-iburo-staging-postbox-confirm";/,
  "Postbox verifier must require a dedicated staging confirmation header",
);
assert.match(
  postboxVerifierSource,
  /const CONFIRM_VALUE = "RUN_STAGING_POSTBOX_VERIFY";/,
  "Postbox verifier confirmation value must remain exact and non-user-controlled",
);
assert.match(
  postboxVerifierSource,
  /to: STAGING_POSTBOX_SIMULATOR_RECIPIENT/,
  "Postbox verifier must send only to the fixed Yandex Postbox simulator recipient",
);
assert.doesNotMatch(
  postboxVerifierSource,
  /request\.(?:json|text|formData|arrayBuffer)\s*\(/,
  "Postbox verifier must not accept a request-body recipient or message payload",
);
assert.match(
  postboxVerifierSource,
  /clientCaseDataIncluded:\s*false/,
  "Postbox verifier must explicitly attest that no client/case data is included",
);
assert.match(
  postboxVerifierSource,
  /providerResponseLogged:\s*false/,
  "Postbox verifier must not log the provider response",
);
assert.match(
  postboxVerifierSource,
  /valuesPrinted:\s*false/,
  "Postbox verifier must not expose configured credential values",
);

const maintenanceHealthRoute = await readFile(
  resolve(stagingRoot, "staging-maintenance-health", "route.ts"),
  "utf8",
);
assert.match(
  maintenanceHealthRoute,
  /const inventory = buildStagingEnvironmentInventory\(env\);/,
  "aggregate health must check the real staging environment, not only queue counts",
);
assert.match(
  maintenanceHealthRoute,
  /maintenance:\s*inventory\.phases\.maintenance\.ready/,
  "missing maintenance worker credentials and origin must block readiness",
);
assert.match(
  maintenanceHealthRoute,
  /scanner:\s*inventory\.phases\.scanner\.ready/,
  "an inactive or unconfigured scanner must block readiness even if the queue is empty",
);
assert.match(
  maintenanceHealthRoute,
  /fileDeletion:\s*durableDeletionMode && inventory\.phases\.maintenance\.ready/,
  "durable deletion readiness must require both the deletion mode and maintenance configuration",
);
assert.match(
  maintenanceHealthRoute,
  /Object\.values\(configuration\)\.every\(\(ready\) => ready === true\)/,
  "the final pass result must fail closed on any missing configuration",
);
assert.match(
  maintenanceHealthRoute,
  /status: pass \? 200 : 503/,
  "the health endpoint must return non-success HTTP status for incomplete readiness",
);

const deletionProofRoute = await readFile(
  resolve(stagingRoot, "staging-file-deletion-worker", "route.ts"),
  "utf8",
);
assert.match(
  deletionProofRoute,
  /where: \{ email: TECHNICAL_E2E_CLIENT\.email \}/,
  "deletion proof must resolve only the dedicated technical client",
);
assert.match(
  deletionProofRoute,
  /where: \{ caseNumber: TECHNICAL_E2E_MUTATION_CASE_NUMBER \}/,
  "deletion proof must resolve only the dedicated technical case",
);
assert.match(
  deletionProofRoute,
  /technicalCase\.clientId !== technicalClient\.id/,
  "deletion proof must reject invalid technical fixture ownership",
);
assert.match(
  deletionProofRoute,
  /target\.clientCaseId !== technicalCase\.id/,
  "deletion proof must reject other clients' deletion intents",
);
assert.match(
  deletionProofRoute,
  /target\.requestedByUserId !== technicalClient\.id/,
  "deletion proof must reject nontechnical requesters",
);
assert.match(
  deletionProofRoute,
  /!target\.objectKey\.startsWith\(`cases\/\$\{technicalCase\.id\}\/`\)/,
  "deletion proof must reject object keys outside the technical case prefix",
);
assert.match(
  deletionProofRoute,
  /target\.storageProvider === getPrivateObjectStorage\(\)\.providerCode/,
  "deletion proof must require the configured private storage provider",
);
assert.match(
  deletionProofRoute,
  /!target \|\| !\(await isDedicatedTechnicalDeletion\(target\)\)/,
  "the fixture guard must execute before any deletion worker runBatch call",
);
assert.ok(
  deletionProofRoute.indexOf("isDedicatedTechnicalDeletion(target)") <
    deletionProofRoute.indexOf("getStoredFileDeletionWorker().runBatch"),
  "deletion proof must validate the fixture before processing a deletion",
);

console.log("STAGING_INTERNAL_ROUTE_BOUNDARY_CONTRACT_PASS");
