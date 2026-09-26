import "dotenv/config";

import {
  GetObjectCommand,
  HeadObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  assertStagingFileScannerTarget,
  STAGING_FILE_SCANNER_TARGET_GUARD,
  type StagingFileScannerTarget,
} from "@/scripts/staging-file-scanner-target-guard";
import { assertStagingScannerFixtureKeysAbsent } from "@/scripts/staging-scanner-fixture-ownership";
import { scanWithHttpMalwareScanner } from "@/server/files/http-malware-scanner-core";
import { VERCEL_BLOB_STORAGE_PROVIDER } from "@/server/files/object-storage-provider";
import { createOidcScopedScannerSmokeStorage } from "@/scripts/staging-scanner-blob-oidc-storage";
import { readBoundedScannerJson } from "@/scripts/staging-scanner-bounded-json";
import {
  MalwareScannerError,
  type MalwareScanVerdict,
} from "@/server/domain/files/scan-worker";

const STAGING_FILE_SCANNER_VERIFY_FAIL = "STAGING_FILE_SCANNER_VERIFY_FAIL";
const FIXTURE_URL_TTL_SECONDS = 300;
const MAX_FIXTURE_BYTES = 1024;
const FIXTURE_MIME_TYPE = "application/pdf";
const STAGING_BASE_URL =
  "https://iburo127-app-git-audit-producti-0d0d70-misterio712rino-projects.vercel.app";
const STAGING_SCANNER_BRIDGE_URL = `${STAGING_BASE_URL}/_iburo/staging-scanner-bridge`;
const BRIDGE_RESPONSE_MAX_BYTES = 512;
const BRIDGE_SCANNER_DIAGNOSTIC_PATTERN =
  /^(?:SCANNER_(?:INVALID_CONFIG|INVALID_SOURCE_URL|INVALID_INPUT|HTTP_5XX|HTTP_4XX|INVALID_RESPONSE|TIMEOUT|NETWORK_(?:DNS|CONNECT_TIMEOUT|REFUSED|RESET|ROUTE|TLS|ERROR))|UPSTREAM(?:_(?:NETWORK|DNS|CONNECT_TIMEOUT|REFUSED|RESET|ROUTE|TLS|TIMEOUT|HTTP|FORMAT|BODY))?)$/;
const BRIDGE_MAX_ATTEMPTS = 4;
const CLEAN_FIXTURE = new TextEncoder().encode("iburo scanner smoke fixture: clean\n");
// EICAR is the industry-standard inert antivirus test string, never executable malware.
const MALICIOUS_TEST_FIXTURE = new TextEncoder().encode(
  "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*",
);

let target: StagingFileScannerTarget;
try {
  target = assertStagingFileScannerTarget(process.env);
} catch (error) {
  const code =
    error instanceof Error && error.message.startsWith(`${STAGING_FILE_SCANNER_TARGET_GUARD}:`)
      ? error.message
      : `${STAGING_FILE_SCANNER_TARGET_GUARD}:UNEXPECTED`;
  console.error(`${STAGING_FILE_SCANNER_VERIFY_FAIL}: ${code}`);
  process.exit(1);
}

function fail(message: string): never {
  console.error(`${STAGING_FILE_SCANNER_VERIFY_FAIL}: ${message}`);
  process.exit(1);
}

function requireSecretEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value || /[\r\n\0]/.test(value)) fail(`invalid ${name}`);
  return value;
}

function readInteger(name: string, fallback: number, min: number, max: number) {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    fail(`${name} must be an integer between ${min} and ${max}`);
  }
  return value;
}

function errorStatus(error: unknown) {
  return (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
}

function errorName(error: unknown) {
  return error instanceof Error && /^[A-Za-z0-9_.-]{1,100}$/.test(error.name)
    ? error.name
    : "UnknownS3Error";
}

function assertFixtureBytes(bytes: Uint8Array) {
  if (bytes.byteLength <= 0 || bytes.byteLength > MAX_FIXTURE_BYTES) {
    throw new Error("INVALID_FIXTURE_SIZE");
  }
}

function scannerConfig(target: StagingFileScannerTarget, scannerTimeoutMs: number) {
  return {
    origin: target.scannerOrigin,
    secret: target.scannerSecret,
    requestTimeoutMs: scannerTimeoutMs,
  };
}

function bridgeControl() {
  const baseUrl = process.env.IB_STAGING_BASE_URL?.trim() ?? "";
  const bypass = requireSecretEnv("VERCEL_AUTOMATION_BYPASS_SECRET");
  const fingerprint = process.env.IB_STAGING_FILE_SCANNER_SECRET_SHA256?.trim().toLowerCase() ?? "";
  const commitSha = process.env.GITHUB_SHA?.trim().toLowerCase() ?? "";
  if (
    baseUrl !== STAGING_BASE_URL ||
    !/^[a-f0-9]{64}$/.test(fingerprint) ||
    !/^[a-f0-9]{40}$/.test(commitSha)
  ) {
    throw new Error("STAGING_SCANNER_BRIDGE_CONFIG_DENIED");
  }
  return {
    bypass,
    fingerprint,
    control: `RUN_STAGING_SCANNER_BRIDGE:${commitSha}:${fingerprint}`,
  };
}

async function callStagingScannerBridge(payload: Record<string, string>) {
  const auth = bridgeControl();
  const maxAttempts = payload.operation === "scan" ? 1 : BRIDGE_MAX_ATTEMPTS;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(STAGING_SCANNER_BRIDGE_URL, {
        method: "POST",
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(30_000),
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          "x-vercel-protection-bypass": auth.bypass,
          "x-iburo-staging-control": auth.bypass,
          "x-iburo-staging-scanner-control": auth.control,
          "x-iburo-staging-scanner-secret-sha256": auth.fingerprint,
        },
        body: JSON.stringify(payload),
      });
    } catch {
      if (attempt === maxAttempts) throw new Error("STAGING_SCANNER_BRIDGE_NETWORK_DENIED");
      await new Promise((resolve) => setTimeout(resolve, 1_000));
      continue;
    }

    if (response.status >= 500 && response.status <= 599) {
      const diagnostic =
        response.headers.get("x-iburo-staging-scanner-bridge-diagnostic")?.trim() ?? "";
      await response.body?.cancel().catch(() => {});
      if (attempt === maxAttempts) {
        if (BRIDGE_SCANNER_DIAGNOSTIC_PATTERN.test(diagnostic)) {
          throw new MalwareScannerError(diagnostic);
        }
        throw new Error("STAGING_SCANNER_BRIDGE_UPSTREAM_DENIED");
      }
      await new Promise((resolve) => setTimeout(resolve, 1_000));
      continue;
    }
    if (response.status !== 200 ||
        response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
      await response.body?.cancel().catch(() => {});
      throw new Error("STAGING_SCANNER_BRIDGE_RESPONSE_DENIED");
    }
    return readBoundedScannerJson(response, BRIDGE_RESPONSE_MAX_BYTES);
  }
  throw new Error("STAGING_SCANNER_BRIDGE_DENIED");
}

async function verifyVercelBridgeHealth() {
  const body = await callStagingScannerBridge({ operation: "health" });
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    Object.keys(body).length !== 2 ||
    (body as { operation?: unknown }).operation !== "health" ||
    (body as { status?: unknown }).status !== "ok"
  ) {
    throw new Error("STAGING_SCANNER_BRIDGE_HEALTH_DENIED");
  }
}

async function scanFixtureThroughVercelBridge(
  sourceUrl: string,
  sizeBytes: bigint,
  expectedVerdict: MalwareScanVerdict,
) {
  const body = await callStagingScannerBridge({
    operation: "scan",
    sourceUrl,
    mimeType: FIXTURE_MIME_TYPE,
    sizeBytes: sizeBytes.toString(),
  });
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    Object.keys(body).length !== 2 ||
    (body as { operation?: unknown }).operation !== "scan" ||
    (body as { verdict?: unknown }).verdict !== expectedVerdict
  ) {
    throw new MalwareScannerError("SCANNER_UNEXPECTED_VERDICT");
  }
}

async function scanFixture(
  target: StagingFileScannerTarget,
  scannerTimeoutMs: number,
  sourceUrl: string,
  mimeType: string,
  sizeBytes: bigint,
  expectedVerdict: MalwareScanVerdict,
) {
  const result = await scanWithHttpMalwareScanner(
    scannerConfig(target, scannerTimeoutMs),
    { sourceUrl, mimeType, sizeBytes },
  );
  if (result.verdict !== expectedVerdict) {
    throw new MalwareScannerError("SCANNER_UNEXPECTED_VERDICT");
  }
}

async function verifyYandexFixture(
  target: Extract<StagingFileScannerTarget, { providerCode: "yandex-object-storage" }>,
  scannerTimeoutMs: number,
  client: S3Client,
  objectKey: string,
  expectedVerdict: MalwareScanVerdict,
) {
  let metadata;
  try {
    metadata = await client.send(
      new HeadObjectCommand({ Bucket: target.storageBucket, Key: objectKey }),
    );
  } catch (error) {
    const status = errorStatus(error);
    throw new Error(`S3_METADATA_${errorName(error)}${status ? `_${status}` : ""}`);
  }

  const sizeBytes = metadata.ContentLength ?? 0;
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_FIXTURE_BYTES) {
    throw new Error("INVALID_FIXTURE_SIZE");
  }
  const mimeType = metadata.ContentType?.trim() || FIXTURE_MIME_TYPE;
  if (mimeType.length > 200 || /[\r\n\0]/.test(mimeType)) {
    throw new Error("INVALID_FIXTURE_MIME_TYPE");
  }

  let sourceUrl: string;
  try {
    sourceUrl = await getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: target.storageBucket, Key: objectKey }),
      { expiresIn: FIXTURE_URL_TTL_SECONDS },
    );
  } catch {
    throw new Error("Yandex fixture URL signing failed");
  }
  await scanFixture(target, scannerTimeoutMs, sourceUrl, mimeType, BigInt(sizeBytes), expectedVerdict);
}

function createVercelBlobSmokeStorage() {
  return createOidcScopedScannerSmokeStorage();
}

type VercelSmokePhase = "BRIDGE_HEALTH" | "PREFLIGHT" | "CLEAN" | "MALICIOUS" | "CLEANUP";
type VercelFixturePhase = "CLEAN" | "MALICIOUS";
type VercelFixtureStep = "UPLOAD_URL" | "UPLOAD_HTTP" | "METADATA" | "DOWNLOAD_URL" | "DOWNLOAD_HTTP" | "SCAN";
const VERCEL_FIXTURE_STEP_PATTERN =
  /^STAGING_SCANNER_STEP_(?:CLEAN|MALICIOUS)_(?:UPLOAD_URL|UPLOAD_HTTP|METADATA|DOWNLOAD_URL|DOWNLOAD_HTTP|SCAN)$/;
const VERCEL_UPLOAD_HTTP_PATTERN =
  /^STAGING_SCANNER_UPLOAD_(?:CLEAN|MALICIOUS)_(?:NETWORK|HTTP_(?:400|401|403|404|409|413|415|429|500|502|503|504|OTHER))$/;

async function runVercelFixtureStep<T>(
  phase: VercelFixturePhase,
  step: VercelFixtureStep,
  task: () => Promise<T>,
): Promise<T> {
  try {
    return await task();
  } catch (error) {
    if (error instanceof MalwareScannerError) throw error;
    if (error instanceof Error && VERCEL_UPLOAD_HTTP_PATTERN.test(error.message)) throw error;
    throw new Error(`STAGING_SCANNER_STEP_${phase}_${step}`);
  }
}

async function runVercelSmokePhase<T>(phase: VercelSmokePhase, task: () => Promise<T>): Promise<T> {
  try {
    return await task();
  } catch (error) {
    if (error instanceof MalwareScannerError) throw error;
    if (
      error instanceof Error &&
      (VERCEL_FIXTURE_STEP_PATTERN.test(error.message) || VERCEL_UPLOAD_HTTP_PATTERN.test(error.message))
    ) throw error;
    throw new Error(`STAGING_SCANNER_PHASE_${phase}`);
  }
}

async function verifyVercelBlobTargetBeforeMutation(
  target: Extract<StagingFileScannerTarget, { providerCode: typeof VERCEL_BLOB_STORAGE_PROVIDER }>,
  storage: ReturnType<typeof createVercelBlobSmokeStorage>,
) {
  const probeUrl = await storage.createPrivateDownloadUrl({
    pathname: target.cleanObjectKey,
    expiresInSeconds: FIXTURE_URL_TTL_SECONDS,
  });

  let parsed: URL;
  try {
    parsed = new URL(probeUrl);
  } catch {
    throw new Error("VERCEL_BLOB_PRIVATE_HOST_MISMATCH");
  }

  if (
    parsed.protocol !== "https:" ||
    parsed.hostname.toLowerCase() !== target.expectedPrivateBlobHost ||
    parsed.port ||
    parsed.username ||
    parsed.password
  ) {
    throw new Error("VERCEL_BLOB_PRIVATE_HOST_MISMATCH");
  }
}

function readPresignedBlobStoreId(uploadUrl: string, objectKey: string) {
  let parsed: URL;
  try {
    parsed = new URL(uploadUrl);
  } catch {
    throw new Error("VERCEL_BLOB_UPLOAD_GRANT_DENIED");
  }
  const delegation = parsed.searchParams.get("vercel-blob-delegation") ?? "";
  if (
    parsed.origin !== "https://vercel.com" ||
    parsed.pathname !== "/api/blob/" ||
    parsed.searchParams.get("pathname") !== objectKey ||
    delegation.length < 20 ||
    delegation.length > 12_288
  ) {
    throw new Error("VERCEL_BLOB_UPLOAD_GRANT_DENIED");
  }

  const payloadSegment = delegation.split(".", 1)[0] ?? "";
  let payload: { storeId?: unknown; pathname?: unknown; operations?: unknown };
  try {
    const normalized = payloadSegment.replace(/-/g, "+").replace(/_/g, "/");
    const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
    payload = JSON.parse(Buffer.from(`${normalized}${padding}`, "base64").toString("utf8")) as {
      storeId?: unknown;
      pathname?: unknown;
      operations?: unknown;
    };
  } catch {
    throw new Error("VERCEL_BLOB_UPLOAD_GRANT_DENIED");
  }

  if (
    typeof payload.storeId !== "string" ||
    typeof payload.pathname !== "string" ||
    !Array.isArray(payload.operations) ||
    payload.pathname !== objectKey ||
    !payload.operations.includes("put")
  ) {
    throw new Error("VERCEL_BLOB_UPLOAD_GRANT_DENIED");
  }

  const storeId = payload.storeId.startsWith("store_")
    ? payload.storeId.slice("store_".length)
    : payload.storeId;
  if (!/^[A-Za-z0-9_-]{3,128}$/.test(storeId)) {
    throw new Error("VERCEL_BLOB_UPLOAD_GRANT_DENIED");
  }

  const expectedHost = requireSecretEnv("IB_STAGING_VERCEL_BLOB_PRIVATE_HOST").toLowerCase();
  const expectedSuffix = ".private.blob.vercel-storage.com";
  if (
    !expectedHost.endsWith(expectedSuffix) ||
    storeId.toLowerCase() !== expectedHost.slice(0, -expectedSuffix.length)
  ) {
    throw new Error("VERCEL_BLOB_UPLOAD_GRANT_DENIED");
  }
  return storeId;
}

async function uploadVercelFixture(
  phase: VercelFixturePhase,
  storage: ReturnType<typeof createVercelBlobSmokeStorage>,
  objectKey: string,
  bytes: Uint8Array,
  recordConfirmedUpload: (key: string) => void,
) {
  assertFixtureBytes(bytes);
  const uploadGrant = await runVercelFixtureStep(phase, "UPLOAD_URL", async () => {
    const url = await storage.createPrivateUploadUrl({
      pathname: objectKey,
      mimeType: FIXTURE_MIME_TYPE,
      maximumSizeInBytes: bytes.byteLength,
      expiresInSeconds: FIXTURE_URL_TTL_SECONDS,
    });
    return { url, storeId: readPresignedBlobStoreId(url, objectKey) };
  });
  await runVercelFixtureStep(phase, "UPLOAD_HTTP", async () => {
    let response: Response;
    try {
      response = await fetch(uploadGrant.url, {
        method: "PUT",
        redirect: "error",
        headers: {
          "content-type": FIXTURE_MIME_TYPE,
          "x-api-blob-request-id":
            `${uploadGrant.storeId}:${Date.now()}:${Math.random().toString(16).slice(2)}`,
          "x-vercel-blob-store-id": uploadGrant.storeId,
          "x-api-blob-request-attempt": "0",
          "x-api-version": "12",
          "x-vercel-blob-access": "private",
          "x-content-type": FIXTURE_MIME_TYPE,
          "x-add-random-suffix": "0",
          "x-allow-overwrite": "0",
        },
        body: new TextDecoder().decode(bytes),
        cache: "no-store",
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      throw new Error(`STAGING_SCANNER_UPLOAD_${phase}_NETWORK`);
    }
    if (!response.ok) {
      await response.body?.cancel().catch(() => {});
      const status = [400, 401, 403, 404, 409, 413, 415, 429, 500, 502, 503, 504].includes(response.status)
        ? String(response.status)
        : "OTHER";
      throw new Error(`STAGING_SCANNER_UPLOAD_${phase}_HTTP_${status}`);
    }
  });
  storage.confirmUploadedFixture(objectKey);
  recordConfirmedUpload(objectKey);
}

async function verifyVercelFixtureDownload(sourceUrl: string, expectedBytes: Uint8Array) {
  let response: Response;
  try {
    response = await fetch(sourceUrl, {
      method: "GET",
      redirect: "error",
      cache: "no-store",
      headers: { Accept: "*/*", "Accept-Encoding": "identity", "Cache-Control": "no-store" },
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new Error("VERCEL_BLOB_DOWNLOAD_NETWORK");
  }
  if (response.status !== 200) {
    await response.body?.cancel().catch(() => {});
    throw new Error("VERCEL_BLOB_DOWNLOAD_STATUS");
  }
  const mediaType = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() ?? "";
  const encoding = response.headers.get("content-encoding")?.trim().toLowerCase() ?? "";
  const declared = response.headers.get("content-length");
  if (
    mediaType !== FIXTURE_MIME_TYPE ||
    (encoding !== "" && encoding !== "identity") ||
    (declared !== null && (!/^\d{1,4}$/.test(declared) || Number(declared) !== expectedBytes.byteLength)) ||
    !response.body
  ) {
    await response.body?.cancel().catch(() => {});
    throw new Error("VERCEL_BLOB_DOWNLOAD_HEADERS");
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > MAX_FIXTURE_BYTES || total > expectedBytes.byteLength) {
        await reader.cancel().catch(() => {});
        throw new Error("VERCEL_BLOB_DOWNLOAD_SIZE");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const actual = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
  if (actual.length !== expectedBytes.byteLength || !actual.equals(Buffer.from(expectedBytes))) {
    throw new Error("VERCEL_BLOB_DOWNLOAD_CONTENT");
  }
}

async function verifyVercelFixture(
  phase: VercelFixturePhase,
  storage: ReturnType<typeof createVercelBlobSmokeStorage>,
  objectKey: string,
  bytes: Uint8Array,
  expectedVerdict: MalwareScanVerdict,
  recordConfirmedUpload: (key: string) => void,
) {
  await uploadVercelFixture(phase, storage, objectKey, bytes, recordConfirmedUpload);
  const metadata = await runVercelFixtureStep(phase, "METADATA", async () => {
    const result = await storage.statPrivateBlob(objectKey);
    if (
      !result ||
      result.sizeBytes !== BigInt(bytes.byteLength) ||
      result.mimeType?.toLowerCase() !== FIXTURE_MIME_TYPE
    ) {
      throw new Error("VERCEL_BLOB_METADATA_MISMATCH");
    }
    return result;
  });
  const sourceUrl = await runVercelFixtureStep(phase, "DOWNLOAD_URL", () =>
    storage.createPrivateDownloadUrl({
      pathname: objectKey,
      expiresInSeconds: FIXTURE_URL_TTL_SECONDS,
    }),
  );
  await runVercelFixtureStep(phase, "DOWNLOAD_HTTP", () =>
    verifyVercelFixtureDownload(sourceUrl, bytes),
  );
  await runVercelFixtureStep(phase, "SCAN", () =>
    scanFixtureThroughVercelBridge(sourceUrl, metadata.sizeBytes, expectedVerdict),
  );
}

async function cleanupVercelFixtures(
  storage: ReturnType<typeof createVercelBlobSmokeStorage>,
  objectKeys: readonly string[],
) {
  let cleanupFailed = false;
  for (const objectKey of objectKeys) {
    try {
      await storage.deletePrivateBlob(objectKey);
    } catch {
      cleanupFailed = true;
    }
  }
  for (const objectKey of objectKeys) {
    let absent = false;
    for (let attempt = 0; attempt < 7; attempt += 1) {
      try {
        if (!(await storage.statPrivateBlob(objectKey))) {
          absent = true;
          break;
        }
      } catch {
        // Keep polling boundedly: Vercel documents delete cache propagation up to 60 seconds.
      }
      if (attempt < 6) await new Promise((resolve) => setTimeout(resolve, 10_000));
    }
    if (!absent) cleanupFailed = true;
  }
  if (cleanupFailed) throw new Error("VERCEL_BLOB_FIXTURE_CLEANUP_FAILED");
}

async function verifyVercelBlobFixtures(
  target: Extract<StagingFileScannerTarget, { providerCode: typeof VERCEL_BLOB_STORAGE_PROVIDER }>,
) {
  await runVercelSmokePhase("BRIDGE_HEALTH", () => verifyVercelBridgeHealth());
  const storage = createVercelBlobSmokeStorage();
  await runVercelSmokePhase("PREFLIGHT", async () => {
    await verifyVercelBlobTargetBeforeMutation(target, storage);
    await assertStagingScannerFixtureKeysAbsent(
      [target.cleanObjectKey, target.maliciousObjectKey],
      (key) => storage.statPrivateBlob(key),
    );
  });

  const confirmedUploads: string[] = [];
  const recordConfirmedUpload = (key: string) => { confirmedUploads.push(key); };
  let primaryError: unknown = null;
  try {
    await runVercelSmokePhase("CLEAN", () => verifyVercelFixture(
      "CLEAN",
      storage,
      target.cleanObjectKey,
      CLEAN_FIXTURE,
      "CLEAN",
      recordConfirmedUpload,
    ));
    await runVercelSmokePhase("MALICIOUS", () => verifyVercelFixture(
      "MALICIOUS",
      storage,
      target.maliciousObjectKey,
      MALICIOUS_TEST_FIXTURE,
      "MALICIOUS",
      recordConfirmedUpload,
    ));
  } catch (error) {
    primaryError = error;
  }

  let cleanupError: unknown = null;
  try {
    await runVercelSmokePhase("CLEANUP", () => cleanupVercelFixtures(storage, confirmedUploads));
  } catch (error) {
    cleanupError = error;
  }
  if (primaryError) throw primaryError;
  if (cleanupError) throw cleanupError;
}

async function verifyYandexFixtures(
  target: Extract<StagingFileScannerTarget, { providerCode: "yandex-object-storage" }>,
  scannerTimeoutMs: number,
) {
  const client = new S3Client({
    endpoint: "https://storage.yandexcloud.net",
    region: "ru-central1",
    credentials: {
      accessKeyId: requireSecretEnv("YANDEX_STORAGE_ACCESS_KEY_ID"),
      secretAccessKey: requireSecretEnv("YANDEX_STORAGE_SECRET_ACCESS_KEY"),
    },
  });
  try {
    await verifyYandexFixture(target, scannerTimeoutMs, client, target.cleanObjectKey, "CLEAN");
    await verifyYandexFixture(target, scannerTimeoutMs, client, target.maliciousObjectKey, "MALICIOUS");
  } finally {
    client.destroy();
  }
}

const scannerTimeoutMs = readInteger(
  "IB_FILE_SCANNER_REQUEST_TIMEOUT_MS",
  60_000,
  1_000,
  120_000,
);

try {
  if (target.providerCode === VERCEL_BLOB_STORAGE_PROVIDER) {
    await verifyVercelBlobFixtures(target);
    console.log("Vercel Blob staging host verified before fixture mutation");
    console.log("Bounded private Vercel Blob scanner fixtures verified: 2");
    console.log("Fixture cleanup verified: 2");
  } else {
    await verifyYandexFixtures(target, scannerTimeoutMs);
    console.log("Dedicated private Yandex scanner fixtures verified: 2");
    console.log("Object mutations/listing performed by verifier: 0");
  }
  console.log("Staging malware scanner target guard verified");
  console.log("Expected CLEAN verdict verified: 1");
  console.log("Expected MALICIOUS verdict verified: 1");
  console.log("Application database/client-case data accessed: 0");
  console.log("Fixture object keys or signed URLs logged: 0");
  console.log("STAGING_FILE_SCANNER_VERIFY_PASS");
} catch (error) {
  const diagnosticCode =
    error instanceof Error &&
    (/^STAGING_SCANNER_PHASE_(?:BRIDGE_HEALTH|PREFLIGHT|CLEAN|MALICIOUS|CLEANUP)$/.test(error.message) ||
      VERCEL_FIXTURE_STEP_PATTERN.test(error.message) ||
      VERCEL_UPLOAD_HTTP_PATTERN.test(error.message))
      ? error.message
      : null;
  const safeCode =
    error instanceof MalwareScannerError ? error.code : diagnosticCode ?? "SCANNER_SMOKE_FAILED";
  fail(safeCode);
}
