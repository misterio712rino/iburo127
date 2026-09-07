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
import { scanWithHttpMalwareScanner } from "@/server/files/http-malware-scanner-core";
import { VERCEL_BLOB_STORAGE_PROVIDER } from "@/server/files/object-storage-provider";
import { readVercelBlobAuthConfig } from "@/server/files/vercel-blob-config";
import { toVercelBlobSdkCredentialOptions } from "@/server/files/vercel-blob-driver-auth";
import { createVercelBlobNativeSignedUrlDependencies } from "@/server/files/vercel-blob-native-signed-url";
import { createVercelBlobSignedUrlDriver } from "@/server/files/vercel-blob-signed-url-driver";
import {
  MalwareScannerError,
  type MalwareScanVerdict,
} from "@/server/domain/files/scan-worker";

const STAGING_FILE_SCANNER_VERIFY_FAIL = "STAGING_FILE_SCANNER_VERIFY_FAIL";
const FIXTURE_URL_TTL_SECONDS = 300;
const MAX_FIXTURE_BYTES = 1024 * 1024;
const FIXTURE_MIME_TYPE = "application/octet-stream";
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
  const credentials = toVercelBlobSdkCredentialOptions(readVercelBlobAuthConfig());
  return createVercelBlobSignedUrlDriver(
    createVercelBlobNativeSignedUrlDependencies(),
    credentials,
  );
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

async function uploadVercelFixture(
  storage: ReturnType<typeof createVercelBlobSmokeStorage>,
  objectKey: string,
  bytes: Uint8Array,
) {
  assertFixtureBytes(bytes);
  const uploadUrl = await storage.createPrivateUploadUrl({
    pathname: objectKey,
    mimeType: FIXTURE_MIME_TYPE,
    maximumSizeInBytes: bytes.byteLength,
    expiresInSeconds: FIXTURE_URL_TTL_SECONDS,
  });
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "content-type": FIXTURE_MIME_TYPE },
    body: new TextDecoder().decode(bytes),
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error("VERCEL_BLOB_UPLOAD_FAILED");
}

async function verifyVercelFixture(
  target: Extract<StagingFileScannerTarget, { providerCode: typeof VERCEL_BLOB_STORAGE_PROVIDER }>,
  scannerTimeoutMs: number,
  storage: ReturnType<typeof createVercelBlobSmokeStorage>,
  objectKey: string,
  bytes: Uint8Array,
  expectedVerdict: MalwareScanVerdict,
) {
  await uploadVercelFixture(storage, objectKey, bytes);
  const metadata = await storage.statPrivateBlob(objectKey);
  if (
    !metadata ||
    metadata.sizeBytes !== BigInt(bytes.byteLength) ||
    metadata.mimeType?.toLowerCase() !== FIXTURE_MIME_TYPE
  ) {
    throw new Error("VERCEL_BLOB_METADATA_MISMATCH");
  }
  const sourceUrl = await storage.createPrivateDownloadUrl({
    pathname: objectKey,
    expiresInSeconds: FIXTURE_URL_TTL_SECONDS,
  });
  await scanFixture(target, scannerTimeoutMs, sourceUrl, FIXTURE_MIME_TYPE, metadata.sizeBytes, expectedVerdict);
}

async function cleanupVercelFixtures(
  storage: ReturnType<typeof createVercelBlobSmokeStorage>,
  target: Extract<StagingFileScannerTarget, { providerCode: typeof VERCEL_BLOB_STORAGE_PROVIDER }>,
) {
  let cleanupFailed = false;
  for (const objectKey of [target.cleanObjectKey, target.maliciousObjectKey]) {
    try {
      await storage.deletePrivateBlob(objectKey);
    } catch {
      cleanupFailed = true;
    }
  }
  for (const objectKey of [target.cleanObjectKey, target.maliciousObjectKey]) {
    try {
      if (await storage.statPrivateBlob(objectKey)) cleanupFailed = true;
    } catch {
      cleanupFailed = true;
    }
  }
  if (cleanupFailed) throw new Error("VERCEL_BLOB_FIXTURE_CLEANUP_FAILED");
}

async function verifyVercelBlobFixtures(
  target: Extract<StagingFileScannerTarget, { providerCode: typeof VERCEL_BLOB_STORAGE_PROVIDER }>,
  scannerTimeoutMs: number,
) {
  const storage = createVercelBlobSmokeStorage();
  await verifyVercelBlobTargetBeforeMutation(target, storage);

  try {
    await cleanupVercelFixtures(storage, target);
    await verifyVercelFixture(
      target,
      scannerTimeoutMs,
      storage,
      target.cleanObjectKey,
      CLEAN_FIXTURE,
      "CLEAN",
    );
    await verifyVercelFixture(
      target,
      scannerTimeoutMs,
      storage,
      target.maliciousObjectKey,
      MALICIOUS_TEST_FIXTURE,
      "MALICIOUS",
    );
  } finally {
    await cleanupVercelFixtures(storage, target);
  }
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
    await verifyVercelBlobFixtures(target, scannerTimeoutMs);
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
  const safeCode = error instanceof MalwareScannerError ? error.code : "SCANNER_SMOKE_FAILED";
  fail(safeCode);
}
