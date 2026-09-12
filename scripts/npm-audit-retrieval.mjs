import { spawn } from "node:child_process";

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BACKOFF_MS = 750;

export function parseNpmAuditReport(stdout) {
  const raw = typeof stdout === "string" ? stdout.trim() : "";
  if (!raw) return { ok: false, reason: "EMPTY_OUTPUT" };

  let report;
  try {
    report = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "INVALID_JSON" };
  }

  if (!report || typeof report !== "object" || Array.isArray(report)) {
    return { ok: false, reason: "INVALID_PAYLOAD" };
  }
  if (report.error) return { ok: false, reason: "UNAVAILABLE_PAYLOAD" };
  if (!report.vulnerabilities || typeof report.vulnerabilities !== "object" || Array.isArray(report.vulnerabilities)) {
    return { ok: false, reason: "INVALID_PAYLOAD" };
  }

  return { ok: true, report, raw: `${raw}\n` };
}

export function runNpmAudit() {
  const executable = process.platform === "win32" ? "npm.cmd" : "npm";
  return new Promise((resolve) => {
    const child = spawn(executable, ["audit", "--json"], { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", () => {
      resolve({ stdout, stderr, exitCode: null });
    });
    child.on("close", (exitCode) => {
      resolve({ stdout, stderr, exitCode });
    });
  });
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function retrieveNpmAuditReport({
  runAudit = runNpmAudit,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  backoffMs = DEFAULT_BACKOFF_MS,
  wait = sleep,
  onRetry,
} = {}) {
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > DEFAULT_MAX_ATTEMPTS) {
    throw new Error("DEPENDENCY_AUDIT_RETRIEVAL_FAIL: invalid retry configuration");
  }

  let lastReason = "UNAVAILABLE";
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let result;
    try {
      result = await runAudit({ attempt });
    } catch {
      result = null;
    }

    const parsed = parseNpmAuditReport(result?.stdout);
    if (parsed.ok) {
      return {
        ...parsed,
        attempt,
        exitCode: result?.exitCode ?? null,
      };
    }

    lastReason = parsed.reason;
    if (attempt < maxAttempts) {
      onRetry?.({ attempt, reason: lastReason });
      await wait(backoffMs * attempt);
    }
  }

  throw new Error(`DEPENDENCY_AUDIT_RETRIEVAL_FAIL: unavailable after ${maxAttempts} attempt(s); reason=${lastReason}`);
}
