import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const productionConfig = await readFile(
  resolve("server/config/production.ts"),
  "utf8",
);
const runtime = await readFile(
  resolve("server/files/scan-worker-runtime.ts"),
  "utf8",
);
const scannerCore = await readFile(
  resolve("server/files/http-malware-scanner-core.ts"),
  "utf8",
);
const objectStorageSigner = await readFile(
  resolve("server/files/yandex-s3-signer.ts"),
  "utf8",
);
const caseProgressOperations = await readFile(
  resolve("server/case-progress/operations.ts"),
  "utf8",
);
const externalReadinessWorkflow = await readFile(
  resolve(".github/workflows/staging-external-readiness.yml"),
  "utf8",
);

assert.match(productionConfig, /IB_FILE_SCANNER_ORIGIN/);
assert.match(productionConfig, /IB_FILE_SCANNER_SECRET/);
assert.match(productionConfig, /IB_FILE_SCANNER_REQUEST_TIMEOUT_MS/);
assert.match(productionConfig, /requireHttpsOrigin\(env, "IB_FILE_SCANNER_ORIGIN"\)/);
assert.match(productionConfig, /IB_FILE_SCAN_BATCH_LIMIT", 1, 1, 10/);
assert.match(productionConfig, /IB_FILE_SCAN_LEASE_SECONDS/);
assert.match(productionConfig, /IB_FILE_SCAN_SOURCE_URL_TTL_SECONDS/);
assert.match(
  productionConfig,
  /fileScanSourceUrlTtlSeconds < fileScanLeaseSeconds/,
);
assert.match(productionConfig, /IB_FILE_SCAN_MAX_ATTEMPTS/);
assert.match(productionConfig, /IB_FILE_SCAN_RETRY_BASE_SECONDS/);
assert.match(productionConfig, /IB_FILE_SCAN_RETRY_MAX_SECONDS/);
assert.match(
  productionConfig,
  /fileScanRetryMaxSeconds < fileScanRetryBaseSeconds/,
);

assert.match(productionConfig, /function requireSafeCredential/);
assert.match(productionConfig, /\/\[\\r\\n\\0\]\/\.test\(value\)/);
assert.match(
  productionConfig,
  /accessKeyId: requireSafeCredential\(env, "YANDEX_STORAGE_ACCESS_KEY_ID"\)/,
);
assert.match(
  productionConfig,
  /secretAccessKey: requireSafeCredential\(env, "YANDEX_STORAGE_SECRET_ACCESS_KEY"\)/,
);
assert.match(
  objectStorageSigner,
  /const config = readYandexObjectStorageConfig\(\);[\s\S]*new S3Client\(/,
);

assert.match(
  runtime,
  /scanner\.requestTimeoutMs >= maintenance\.fileScanLeaseSeconds \* 1000/,
);
assert.match(runtime, /new HttpMalwareScanner\(scanner\)/);

assert.match(scannerCore, /parsed\.protocol !== "https:"/);
assert.match(scannerCore, /X-Amz-Signature/);
assert.match(scannerCore, /redirect: "error"/);
assert.match(scannerCore, /SCANNER_RESPONSE_MAX_BYTES = 16 \* 1024/);
assert.doesNotMatch(scannerCore, /fileName\s*:/);
assert.doesNotMatch(scannerCore, /clientCaseId\s*:/);
assert.doesNotMatch(scannerCore, /userId\s*:/);

assert.match(
  caseProgressOperations,
  /storedFileService\.list\(actor, clientCase\.id\)/,
  "case progress must use the actor-scoped visible file list",
);
assert.match(
  caseProgressOperations,
  /readyFileCount:\s*visibleFiles\.filter\(\(file\) => file\.status === "READY"\)\.length/,
  "case progress must count only READY files as safe",
);
assert.doesNotMatch(
  caseProgressOperations,
  /readyFileCount:\s*visibleFiles\.length/,
  "case progress must not label all client-visible scan states as safe files",
);

const maintenanceHealthStep =
  externalReadinessWorkflow
    .split("- name: Verify aggregate maintenance backlog health")[1]
    ?.split("- name: Verify private staging storage")[0] ?? "";
assert.ok(maintenanceHealthStep, "external readiness must keep the maintenance health step");
assert.match(
  maintenanceHealthStep,
  /max_attempts=6[\s\S]*delay_seconds=3[\s\S]*for attempt in \$\(seq 1 "\$max_attempts"\); do/,
  "maintenance health must use a bounded retry loop for transient Preview alias misses",
);
assert.match(
  maintenanceHealthStep,
  /\[ "\$http_status" != "404" \] && \[ "\$http_status" != "000" \]/,
  "maintenance health retries must be limited to transient edge-miss and network statuses",
);
assert.match(
  maintenanceHealthStep,
  /x-iburo-staging-maintenance-health-confirm: RUN_STAGING_MAINTENANCE_HEALTH:\$\{GITHUB_SHA\}/,
  "maintenance health retries must remain bound to the exact candidate SHA",
);
assert.match(
  maintenanceHealthStep,
  /if \[ "\$http_status" != "200" \]; then/,
  "maintenance health must continue to fail closed on a real 503 unhealthy verdict",
);

console.log("FILE_SCAN_CONFIG_CONTRACT_PASS");
