import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer, type IncomingMessage } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const secret = "maintenance-test-secret-" + "x".repeat(24);
const requests: Array<{
  method: string | undefined;
  url: string | undefined;
  authorization: string | undefined;
}> = [];
let responseMode: "healthy" | "unhealthy" | "redirect" = "healthy";

function recordRequest(request: IncomingMessage) {
  requests.push({
    method: request.method,
    url: request.url,
    authorization: request.headers.authorization,
  });
}

const server = createServer((request, response) => {
  recordRequest(request);

  if (responseMode === "redirect") {
    response.statusCode = 307;
    response.setHeader("Location", "/should-not-follow");
    response.end();
    return;
  }

  response.statusCode = responseMode === "healthy" ? 200 : 503;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(
    JSON.stringify(
      responseMode === "healthy"
        ? { ok: true, data: { processed: 0 } }
        : { ok: false, error: { code: "RETRY_REQUIRED" } },
    ),
  );
});

server.listen(0, "127.0.0.1");
await once(server, "listening");

const address = server.address();
assert.ok(address && typeof address === "object");
const baseUrl = `http://127.0.0.1:${address.port}`;
const runnerPath = resolve("scripts/run-maintenance-job.mjs");

type RunnerResult = {
  code: number | null;
  stdout: string;
  stderr: string;
};

async function runRunner(
  job: string,
  envOverrides: Record<string, string> = {},
): Promise<RunnerResult> {
  const child = spawn(process.execPath, [runnerPath, job], {
    env: {
      ...process.env,
      IB_MAINTENANCE_BASE_URL: baseUrl,
      IB_MAINTENANCE_SECRET: secret,
      IB_MAINTENANCE_REQUEST_TIMEOUT_MS: "5000",
      ...envOverrides,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk: string) => {
    stderr += chunk;
  });

  const [code] = (await once(child, "exit")) as [number | null, NodeJS.Signals | null];
  return { code, stdout, stderr };
}

try {
  const notificationResult = await runRunner("notification-deliveries");
  assert.equal(notificationResult.code, 0);
  assert.match(notificationResult.stdout, /MAINTENANCE_SCHEDULER_PASS job=notification-deliveries status=200/);
  assert.equal(requests.at(-1)?.method, "POST");
  assert.equal(requests.at(-1)?.url, "/api/internal/maintenance/notification-deliveries");
  assert.equal(requests.at(-1)?.authorization, `Bearer ${secret}`);

  const notificationHealthResult = await runRunner("notification-delivery-health");
  assert.equal(notificationHealthResult.code, 0);
  assert.match(notificationHealthResult.stdout, /MAINTENANCE_SCHEDULER_PASS job=notification-delivery-health status=200/);
  assert.equal(requests.at(-1)?.method, "POST");
  assert.equal(requests.at(-1)?.url, "/api/internal/maintenance/notification-delivery-health");
  assert.equal(requests.at(-1)?.authorization, `Bearer ${secret}`);

  const staleUploadResult = await runRunner("stale-uploads");
  assert.equal(staleUploadResult.code, 0);
  assert.match(staleUploadResult.stdout, /MAINTENANCE_SCHEDULER_PASS job=stale-uploads status=200/);
  assert.equal(requests.at(-1)?.method, "POST");
  assert.equal(requests.at(-1)?.url, "/api/internal/maintenance/stale-uploads");
  assert.equal(requests.at(-1)?.authorization, `Bearer ${secret}`);

  const staleUploadHealthResult = await runRunner("stale-upload-health");
  assert.equal(staleUploadHealthResult.code, 0);
  assert.match(staleUploadHealthResult.stdout, /MAINTENANCE_SCHEDULER_PASS job=stale-upload-health status=200/);
  assert.equal(requests.at(-1)?.method, "POST");
  assert.equal(requests.at(-1)?.url, "/api/internal/maintenance/stale-upload-health");
  assert.equal(requests.at(-1)?.authorization, `Bearer ${secret}`);

  const fileScanResult = await runRunner("file-scans");
  assert.equal(fileScanResult.code, 0);
  assert.match(fileScanResult.stdout, /MAINTENANCE_SCHEDULER_PASS job=file-scans status=200/);
  assert.equal(requests.at(-1)?.method, "POST");
  assert.equal(requests.at(-1)?.url, "/api/internal/maintenance/file-scans");
  assert.equal(requests.at(-1)?.authorization, `Bearer ${secret}`);

  const fileScanHealthResult = await runRunner("file-scan-health");
  assert.equal(fileScanHealthResult.code, 0);
  assert.match(fileScanHealthResult.stdout, /MAINTENANCE_SCHEDULER_PASS job=file-scan-health status=200/);
  assert.equal(requests.at(-1)?.method, "POST");
  assert.equal(requests.at(-1)?.url, "/api/internal/maintenance/file-scan-health");
  assert.equal(requests.at(-1)?.authorization, `Bearer ${secret}`);

  const aiAuditHealthResult = await runRunner("ai-audit-health");
  assert.equal(aiAuditHealthResult.code, 0);
  assert.match(aiAuditHealthResult.stdout, /MAINTENANCE_SCHEDULER_PASS job=ai-audit-health status=200/);
  assert.equal(requests.at(-1)?.method, "POST");
  assert.equal(requests.at(-1)?.url, "/api/internal/maintenance/ai-audit-health");
  assert.equal(requests.at(-1)?.authorization, `Bearer ${secret}`);

  for (const output of [
    notificationResult.stdout,
    notificationResult.stderr,
    notificationHealthResult.stdout,
    notificationHealthResult.stderr,
    staleUploadResult.stdout,
    staleUploadResult.stderr,
    staleUploadHealthResult.stdout,
    staleUploadHealthResult.stderr,
    fileScanResult.stdout,
    fileScanResult.stderr,
    fileScanHealthResult.stdout,
    fileScanHealthResult.stderr,
    aiAuditHealthResult.stdout,
    aiAuditHealthResult.stderr,
  ]) {
    assert.doesNotMatch(output, new RegExp(secret));
  }

  responseMode = "unhealthy";
  const unhealthyResult = await runRunner("stale-upload-health");
  assert.equal(unhealthyResult.code, 1);
  assert.match(unhealthyResult.stderr, /MAINTENANCE_SCHEDULER_FAIL:unhealthy response for stale-upload-health status=503/);
  assert.doesNotMatch(unhealthyResult.stderr, new RegExp(secret));

  responseMode = "redirect";
  const redirectResult = await runRunner("stale-uploads");
  assert.equal(redirectResult.code, 1);
  assert.match(redirectResult.stderr, /MAINTENANCE_SCHEDULER_FAIL:request failed for stale-uploads/);
  assert.doesNotMatch(redirectResult.stderr, new RegExp(secret));

  const requestCountBeforeInvalidJob = requests.length;
  const invalidJobResult = await runRunner("unknown-job");
  assert.equal(invalidJobResult.code, 1);
  assert.match(
    invalidJobResult.stderr,
    /MAINTENANCE_SCHEDULER_FAIL:unsupported maintenance job/,
  );
  assert.equal(requests.length, requestCountBeforeInvalidJob);

  const insecureOriginResult = await runRunner("notification-deliveries", {
    IB_MAINTENANCE_BASE_URL: "http://example.com",
  });
  assert.equal(insecureOriginResult.code, 1);
  assert.match(insecureOriginResult.stderr, /IB_MAINTENANCE_BASE_URL/);

  const shortSecretResult = await runRunner("notification-deliveries", {
    IB_MAINTENANCE_SECRET: "too-short",
  });
  assert.equal(shortSecretResult.code, 1);
  assert.match(shortSecretResult.stderr, /IB_MAINTENANCE_SECRET/);

  const invalidTimeoutResult = await runRunner("file-scans", {
    IB_MAINTENANCE_FILE_SCAN_TIMEOUT_MS: "300001",
  });
  assert.equal(invalidTimeoutResult.code, 1);
  assert.match(invalidTimeoutResult.stderr, /IB_MAINTENANCE_FILE_SCAN_TIMEOUT_MS/);

  const notificationRoute = await readFile(resolve("app/api/internal/maintenance/notification-deliveries/route.ts"), "utf8");
  const notificationAuth = notificationRoute.indexOf("isAuthorizedMaintenanceRequest(");
  const notificationWorker = notificationRoute.indexOf("getNotificationDeliveryWorker()");
  assert.ok(notificationAuth >= 0 && notificationWorker > notificationAuth);
  assert.match(notificationRoute, /const DELIVERY_BATCH_LIMIT = 10;/);
  assert.match(notificationRoute, /Cache-Control": "no-store"/);

  const notificationHealthRoute = await readFile(resolve("app/api/internal/maintenance/notification-delivery-health/route.ts"), "utf8");
  const notificationHealthAuth = notificationHealthRoute.indexOf("isAuthorizedMaintenanceRequest(");
  const notificationHealthService = notificationHealthRoute.indexOf("getNotificationDeliveryHealthService()");
  assert.ok(notificationHealthAuth >= 0 && notificationHealthService > notificationHealthAuth);
  assert.match(notificationHealthRoute, /config\.notificationDeliveryHealthGraceMinutes/);
  assert.match(notificationHealthRoute, /config\.notificationDeliveryHealthBatchLimit/);
  assert.match(notificationHealthRoute, /NOTIFICATION_DELIVERY_BACKLOG_UNHEALTHY/);
  assert.match(notificationHealthRoute, /Cache-Control": "no-store"/);
  assert.doesNotMatch(notificationHealthRoute, /notificationId\s*:/);
  assert.doesNotMatch(notificationHealthRoute, /userId\s*:/);
  assert.doesNotMatch(notificationHealthRoute, /recipientEmail\s*:/);
  assert.doesNotMatch(notificationHealthRoute, /leaseToken\s*:/);

  const staleUploadRoute = await readFile(resolve("app/api/internal/maintenance/stale-uploads/route.ts"), "utf8");
  const staleUploadAuth = staleUploadRoute.indexOf("isAuthorizedMaintenanceRequest(");
  const staleUploadCleanup = staleUploadRoute.indexOf("getPendingUploadCleanupService()");
  assert.ok(staleUploadAuth >= 0 && staleUploadCleanup > staleUploadAuth);
  assert.match(staleUploadRoute, /config\.staleUploadBatchLimit/);
  assert.match(staleUploadRoute, /Cache-Control": "no-store"/);

  const staleUploadHealthRoute = await readFile(resolve("app/api/internal/maintenance/stale-upload-health/route.ts"), "utf8");
  const staleUploadHealthAuth = staleUploadHealthRoute.indexOf("isAuthorizedMaintenanceRequest(");
  const staleUploadHealthService = staleUploadHealthRoute.indexOf("getStaleUploadHealthService()");
  assert.ok(staleUploadHealthAuth >= 0 && staleUploadHealthService > staleUploadHealthAuth);
  assert.match(staleUploadHealthRoute, /config\.staleUploadMaxAgeMinutes/);
  assert.match(staleUploadHealthRoute, /config\.staleUploadHealthGraceMinutes/);
  assert.match(staleUploadHealthRoute, /config\.staleUploadHealthBatchLimit/);
  assert.match(staleUploadHealthRoute, /STALE_UPLOAD_BACKLOG_UNHEALTHY/);
  assert.match(staleUploadHealthRoute, /Cache-Control": "no-store"/);
  assert.doesNotMatch(staleUploadHealthRoute, /fileId\s*:/);
  assert.doesNotMatch(staleUploadHealthRoute, /clientCaseId\s*:/);
  assert.doesNotMatch(staleUploadHealthRoute, /uploadedById\s*:/);
  assert.doesNotMatch(staleUploadHealthRoute, /objectKey\s*:/);

  const fileScanRoute = await readFile(resolve("app/api/internal/maintenance/file-scans/route.ts"), "utf8");
  const fileScanAuth = fileScanRoute.indexOf("isAuthorizedMaintenanceRequest(");
  const fileScanWorker = fileScanRoute.indexOf("getStoredFileScanWorker()");
  assert.ok(fileScanAuth >= 0 && fileScanWorker > fileScanAuth);
  assert.match(fileScanRoute, /config\.fileScanBatchLimit/);
  assert.match(fileScanRoute, /FILE_SCAN_ATTENTION_REQUIRED/);
  assert.match(fileScanRoute, /Cache-Control": "no-store"/);
  assert.doesNotMatch(fileScanRoute, /fileId\s*:/);
  assert.doesNotMatch(fileScanRoute, /clientCaseId\s*:/);
  assert.doesNotMatch(fileScanRoute, /scanLeaseToken\s*:/);
  assert.doesNotMatch(fileScanRoute, /sourceUrl\s*:/);

  const fileScanHealthRoute = await readFile(resolve("app/api/internal/maintenance/file-scan-health/route.ts"), "utf8");
  const fileScanHealthAuth = fileScanHealthRoute.indexOf("isAuthorizedMaintenanceRequest(");
  const fileScanHealthService = fileScanHealthRoute.indexOf("getStoredFileScanHealthService()");
  assert.ok(fileScanHealthAuth >= 0 && fileScanHealthService > fileScanHealthAuth);
  assert.match(fileScanHealthRoute, /config\.fileScanHealthGraceMinutes/);
  assert.match(fileScanHealthRoute, /config\.fileScanHealthBatchLimit/);
  assert.match(fileScanHealthRoute, /FILE_SCAN_BACKLOG_UNHEALTHY/);
  assert.match(fileScanHealthRoute, /Cache-Control": "no-store"/);
  assert.doesNotMatch(fileScanHealthRoute, /fileId\s*:/);
  assert.doesNotMatch(fileScanHealthRoute, /clientCaseId\s*:/);
  assert.doesNotMatch(fileScanHealthRoute, /uploadedById\s*:/);
  assert.doesNotMatch(fileScanHealthRoute, /objectKey\s*:/);
  assert.doesNotMatch(fileScanHealthRoute, /scanLeaseToken\s*:/);

  const aiAuditHealthRoute = await readFile(resolve("app/api/internal/maintenance/ai-audit-health/route.ts"), "utf8");
  const aiAuditHealthAuth = aiAuditHealthRoute.indexOf("isAuthorizedMaintenanceRequest(");
  const aiAuditHealthService = aiAuditHealthRoute.indexOf("getAiAuditHealthService()");
  assert.ok(aiAuditHealthAuth >= 0 && aiAuditHealthService > aiAuditHealthAuth);
  assert.match(aiAuditHealthRoute, /config\.aiAuditGraceMinutes/);
  assert.match(aiAuditHealthRoute, /config\.aiAuditBatchLimit/);
  assert.match(aiAuditHealthRoute, /AI_AUDIT_OUTCOME_MISSING/);
  assert.match(aiAuditHealthRoute, /Cache-Control": "no-store"/);
  assert.doesNotMatch(aiAuditHealthRoute, /auditId\s*:/);
  assert.doesNotMatch(aiAuditHealthRoute, /clientCaseId\s*:/);
  assert.doesNotMatch(aiAuditHealthRoute, /actorUserId\s*:/);

  console.log("MAINTENANCE_SCHEDULER_RUNNER_TEST_PASS");
} finally {
  server.close();
  await once(server, "close");
}
