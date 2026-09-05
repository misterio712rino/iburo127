import { pathToFileURL } from "node:url";

const JOB_PATHS = Object.freeze({
  "notification-deliveries": "/api/internal/maintenance/notification-deliveries",
  "notification-delivery-health": "/api/internal/maintenance/notification-delivery-health",
  "task-reminders": "/api/internal/maintenance/task-reminders",
  "questionnaire-reminders": "/api/internal/maintenance/questionnaire-reminders",
  "stale-uploads": "/api/internal/maintenance/stale-uploads",
  "stale-upload-health": "/api/internal/maintenance/stale-upload-health",
  "file-scans": "/api/internal/maintenance/file-scans",
  "file-scan-health": "/api/internal/maintenance/file-scan-health",
  "ai-audit-health": "/api/internal/maintenance/ai-audit-health",
});

function fail(message) {
  throw new Error(`MAINTENANCE_SCHEDULER_FAIL:${message}`);
}

function requireSecret(env) {
  const secret = env.IB_MAINTENANCE_SECRET?.trim();
  if (!secret || secret.length < 32 || /[\r\n\0]/.test(secret)) {
    fail("IB_MAINTENANCE_SECRET");
  }
  return secret;
}

function parseOrigin(value, name) {
  const raw = value?.trim();
  if (!raw) fail(name);

  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    fail(name);
  }

  const loopback =
    parsed.hostname === "localhost" ||
    parsed.hostname === "127.0.0.1" ||
    parsed.hostname === "[::1]";
  const secureProtocol = parsed.protocol === "https:" || (loopback && parsed.protocol === "http:");
  const originOnly =
    (parsed.pathname === "/" || parsed.pathname === "") &&
    !parsed.search &&
    !parsed.hash &&
    !parsed.username &&
    !parsed.password;

  if (!secureProtocol || !originOnly) fail(name);
  return { origin: parsed.origin, loopback };
}

function requireBaseUrl(env) {
  return parseOrigin(env.IB_MAINTENANCE_BASE_URL, "IB_MAINTENANCE_BASE_URL");
}

function assertMaintenanceEnvironmentTarget(env, target) {
  if (target.loopback) return;

  const runtimeTarget = env.IB_RUNTIME_TARGET?.trim();
  if (runtimeTarget !== "staging" && runtimeTarget !== "production") {
    fail("IB_RUNTIME_TARGET must be staging or production for non-loopback maintenance requests");
  }

  const authOrigin = parseOrigin(env.BETTER_AUTH_URL, "BETTER_AUTH_URL");
  if (authOrigin.origin !== target.origin) {
    fail("IB_MAINTENANCE_BASE_URL must match BETTER_AUTH_URL origin");
  }

  if (runtimeTarget === "production") {
    const expectedConfirmation = `PRODUCTION:${target.origin}`;
    if (env.IB_MAINTENANCE_PRODUCTION_CONFIRM?.trim() !== expectedConfirmation) {
      fail("IB_MAINTENANCE_PRODUCTION_CONFIRM");
    }
    return;
  }

  const stagingOrigin = parseOrigin(env.IB_STAGING_BASE_URL, "IB_STAGING_BASE_URL");
  if (stagingOrigin.origin !== target.origin) {
    fail("IB_MAINTENANCE_BASE_URL must match IB_STAGING_BASE_URL in staging");
  }
}

function readBoundedTimeout(env, name, fallback) {
  const raw = env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1_000 || value > 300_000) {
    fail(name);
  }
  return value;
}

function readTimeoutMs(env, job) {
  if (job === "file-scans") {
    return readBoundedTimeout(env, "IB_MAINTENANCE_FILE_SCAN_TIMEOUT_MS", 120_000);
  }
  return readBoundedTimeout(env, "IB_MAINTENANCE_REQUEST_TIMEOUT_MS", 15_000);
}

function requireJob(job) {
  if (!Object.hasOwn(JOB_PATHS, job)) {
    fail(
      "job must be notification-deliveries, notification-delivery-health, stale-uploads, stale-upload-health, file-scans, file-scan-health, or ai-audit-health; additional supported jobs: task-reminders, questionnaire-reminders",
    );
  }
  return job;
}

export async function runMaintenanceJob({
  job,
  env = process.env,
  fetchImpl = globalThis.fetch,
} = {}) {
  const resolvedJob = requireJob(job);
  if (typeof fetchImpl !== "function") fail("fetch is unavailable");

  const target = requireBaseUrl(env);
  assertMaintenanceEnvironmentTarget(env, target);
  const secret = requireSecret(env);
  const timeoutMs = readTimeoutMs(env, resolvedJob);
  const endpoint = new URL(JOB_PATHS[resolvedJob], `${target.origin}/`);

  let response;
  try {
    response = await fetchImpl(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        Accept: "application/json",
      },
      redirect: "error",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    fail(`request failed for ${resolvedJob}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    fail(`non-JSON response for ${resolvedJob} status=${response.status}`);
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    fail(`malformed JSON response for ${resolvedJob} status=${response.status}`);
  }

  const healthy =
    response.ok &&
    payload !== null &&
    typeof payload === "object" &&
    payload.ok === true;

  if (!healthy) {
    fail(`unhealthy response for ${resolvedJob} status=${response.status}`);
  }

  return {
    job: resolvedJob,
    status: response.status,
  };
}

async function main() {
  try {
    const result = await runMaintenanceJob({ job: process.argv[2] });
    console.log(`MAINTENANCE_SCHEDULER_PASS job=${result.job} status=${result.status}`);
  } catch (error) {
    console.error(
      error instanceof Error
        ? error.message
        : "MAINTENANCE_SCHEDULER_FAIL:unknown failure",
    );
    process.exitCode = 1;
  }
}

const invokedAsScript = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

if (invokedAsScript) {
  await main();
}
