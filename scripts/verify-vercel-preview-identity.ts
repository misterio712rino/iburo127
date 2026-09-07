import { VERCEL_STAGING_BRANCH } from "@/server/config/vercel-preview-boundary";

const PREVIEW_IDENTITY_PATH = "/_iburo/staging-identity";
const REQUEST_TIMEOUT_MS = 10_000;
const RELEASE_MODE_FLAG = "--release";

function fail(message: string): never {
  console.error(`VERCEL_PREVIEW_IDENTITY_FAIL: ${message}`);
  process.exit(1);
}

function requireExpectedSha(value: string | undefined) {
  const sha = value?.trim().toLowerCase();
  if (!sha || !/^[a-f0-9]{40}$/.test(sha)) {
    fail("expected SHA must be an exact 40-character lowercase/uppercase Git SHA");
  }
  return sha;
}

function requireExpectedBackendEnabled(value: string | undefined) {
  const normalized = value?.trim().toLowerCase();
  if (!normalized || normalized === "false") return false;
  if (normalized === "true") return true;
  fail("expected backend state must be exactly true or false");
}

function requirePreviewBaseUrl(value: string | undefined) {
  if (!value?.trim()) fail("preview URL is required");

  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    fail("preview URL must be a valid absolute URL");
  }

  if (url.protocol !== "https:") fail("preview URL must use HTTPS");
  if (url.username || url.password) fail("preview URL must not contain credentials");
  if (url.search || url.hash) fail("preview URL must not contain query or fragment components");

  url.pathname = PREVIEW_IDENTITY_PATH;
  return url;
}

async function main() {
  const releaseMode = process.argv[2] === RELEASE_MODE_FLAG;
  const previewUrl = requirePreviewBaseUrl(
    releaseMode ? process.env.IB_STAGING_BASE_URL : process.argv[2] ?? process.env.IB_STAGING_BASE_URL,
  );
  const expectedSha = requireExpectedSha(
    releaseMode ? process.env.IB_STAGING_EXPECTED_SHA : process.argv[3] ?? process.env.IB_STAGING_EXPECTED_SHA,
  );
  const expectedBackendEnabled = releaseMode
    ? true
    : requireExpectedBackendEnabled(
        process.argv[4] ?? process.env.IB_STAGING_EXPECTED_BACKEND_ENABLED,
      );

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(previewUrl, {
      method: "GET",
      redirect: "error",
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
  } catch (error) {
    fail(error instanceof Error ? `request failed: ${error.name}` : "request failed");
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) fail(`identity endpoint returned HTTP ${response.status}`);

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    fail("identity endpoint did not return application/json");
  }

  const contentLength = Number(response.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > 16_384) {
    fail("identity response exceeds 16 KiB");
  }

  const text = await response.text();
  if (Buffer.byteLength(text, "utf8") > 16_384) fail("identity response exceeds 16 KiB");

  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    fail("identity response is not valid JSON");
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    fail("identity response must be a JSON object");
  }

  const identity = payload as Record<string, unknown>;
  const exactKeys = ["service", "environment", "branch", "commitSha", "runtimeTarget", "backendEnabled"].sort();
  const actualKeys = Object.keys(identity).sort();
  if (JSON.stringify(actualKeys) !== JSON.stringify(exactKeys)) {
    fail("identity response contains an unexpected field set");
  }

  if (identity.service !== "iburo127") fail("unexpected service identity");
  if (identity.environment !== "preview") fail("deployment is not a Vercel Preview environment");
  if (identity.branch !== VERCEL_STAGING_BRANCH) fail("deployment is not from the staging branch");
  if (typeof identity.commitSha !== "string" || identity.commitSha.toLowerCase() !== expectedSha) {
    fail("deployment commit SHA does not match the expected exact candidate SHA");
  }
  if (identity.runtimeTarget !== "staging") fail("runtime target is not staging");
  if (identity.backendEnabled !== expectedBackendEnabled) {
    fail(
      `backendEnabled does not match expected ${expectedBackendEnabled ? "enabled" : "disabled"} phase`,
    );
  }

  console.log(
    `VERCEL_PREVIEW_IDENTITY_PASS: branch=${VERCEL_STAGING_BRANCH} sha=${expectedSha} backendEnabled=${expectedBackendEnabled}`,
  );
}

await main();
