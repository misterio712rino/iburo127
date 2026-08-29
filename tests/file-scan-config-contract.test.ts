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

console.log("FILE_SCAN_CONFIG_CONTRACT_PASS");
