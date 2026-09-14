import {
  requireStagingHttpTarget,
  STAGING_HTTP_TARGET_GUARD,
} from "./staging-http-target-guard";

export const STAGING_HTTP_MUTATION_PREFLIGHT_FAIL = "STAGING_HTTP_MUTATION_PREFLIGHT_FAIL";

export type StagingHttpMutationPreflight = {
  baseUrl: string;
  filesE2e: boolean;
  fileScanE2e: boolean;
  fileScanMaxRuns: number;
};

function fail(reason: string): never {
  throw new Error(`${STAGING_HTTP_MUTATION_PREFLIGHT_FAIL}:${reason}`);
}

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim();
  if (!value) fail(`missing ${name}`);
  return value;
}

function requireSafeSecret(env: NodeJS.ProcessEnv, name: string, minLength: number): string {
  const raw = env[name];
  if (!raw) fail(`missing ${name}`);
  if (
    raw !== raw.trim() ||
    raw.length < minLength ||
    /[\r\n\0]/.test(raw)
  ) {
    fail(`${name} must be a safe secret of at least ${minLength} characters`);
  }
  return raw;
}

function readOptInFlag(env: NodeJS.ProcessEnv, name: string): boolean {
  const value = env[name]?.trim() ?? "0";
  if (value !== "0" && value !== "1") fail(`${name} must equal 0 or 1`);
  return value === "1";
}

function readBoundedInteger(
  env: NodeJS.ProcessEnv,
  name: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const raw = env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    fail(`${name} must be an integer between ${min} and ${max}`);
  }
  return value;
}

function requireMutationBaseUrl(env: NodeJS.ProcessEnv): URL {
  try {
    return requireStagingHttpTarget(env);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith(`${STAGING_HTTP_TARGET_GUARD}:`)) {
      fail(error.message);
    }
    fail(`${STAGING_HTTP_TARGET_GUARD}:unexpected target guard failure`);
  }
}

export function requireStagingHttpMutationPreflight(
  env: NodeJS.ProcessEnv = process.env,
): StagingHttpMutationPreflight {
  const baseUrl = requireMutationBaseUrl(env);

  if (required(env, "IB_STAGING_MUTATION_TARGET") !== "staging") {
    fail("IB_STAGING_MUTATION_TARGET must equal staging");
  }
  const expectedMutationConfirmation = `MUTATE:${baseUrl.host}`;
  if (required(env, "IB_STAGING_MUTATION_CONFIRM") !== expectedMutationConfirmation) {
    fail(`IB_STAGING_MUTATION_CONFIRM must equal ${expectedMutationConfirmation}`);
  }

  const clientCookie = required(env, "IB_STAGING_CLIENT_COOKIE");
  required(env, "IB_STAGING_LAWYER_COOKIE");
  required(env, "IB_STAGING_MANAGER_COOKIE");
  required(env, "IB_STAGING_MUTATION_CASE_NUMBER");
  required(env, "IB_STAGING_MUTATION_TASK_ID");

  const filesE2e = readOptInFlag(env, "IB_STAGING_FILES_E2E");
  const fileScanE2e = readOptInFlag(env, "IB_STAGING_FILE_SCAN_E2E");
  const fileScanMaxRuns = readBoundedInteger(
    env,
    "IB_STAGING_FILE_SCAN_E2E_MAX_RUNS",
    5,
    1,
    20,
  );

  if (fileScanE2e && !filesE2e) {
    fail("IB_STAGING_FILE_SCAN_E2E requires IB_STAGING_FILES_E2E=1");
  }

  if (filesE2e) {
    const expectedBucketConfirmation = `PRIVATE_STAGING_BUCKET:${baseUrl.host}`;
    if (required(env, "IB_STAGING_PRIVATE_BUCKET_CONFIRM") !== expectedBucketConfirmation) {
      fail(`IB_STAGING_PRIVATE_BUCKET_CONFIRM must equal ${expectedBucketConfirmation}`);
    }
    const otherClientCookie = required(env, "IB_STAGING_OTHER_CLIENT_COOKIE");
    if (otherClientCookie === clientCookie) {
      fail("IB_STAGING_OTHER_CLIENT_COOKIE must belong to a different CLIENT fixture");
    }
  }

  if (fileScanE2e) {
    const expectedScanConfirmation = `SCAN:${baseUrl.host}`;
    if (required(env, "IB_STAGING_FILE_SCAN_E2E_CONFIRM") !== expectedScanConfirmation) {
      fail(`IB_STAGING_FILE_SCAN_E2E_CONFIRM must equal ${expectedScanConfirmation}`);
    }
    requireSafeSecret(env, "IB_MAINTENANCE_SECRET", 32);
  }

  return {
    baseUrl: baseUrl.origin,
    filesE2e,
    fileScanE2e,
    fileScanMaxRuns,
  };
}
