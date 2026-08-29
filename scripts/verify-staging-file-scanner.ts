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
} from "@/scripts/staging-file-scanner-target-guard";
import {
  scanWithHttpMalwareScanner,
} from "@/server/files/http-malware-scanner-core";
import {
  MalwareScannerError,
  type MalwareScanVerdict,
} from "@/server/domain/files/scan-worker";

const STAGING_FILE_SCANNER_VERIFY_FAIL = "STAGING_FILE_SCANNER_VERIFY_FAIL";
const FIXTURE_URL_TTL_SECONDS = 300;
const MAX_FIXTURE_BYTES = 1024 * 1024;

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

let target;
try {
  target = assertStagingFileScannerTarget(process.env);
} catch (error) {
  const code =
    error instanceof Error && error.message.startsWith(`${STAGING_FILE_SCANNER_TARGET_GUARD}:`)
      ? error.message
      : `${STAGING_FILE_SCANNER_TARGET_GUARD}:UNEXPECTED`;
  fail(code);
}

const scannerTimeoutMs = readInteger(
  "IB_FILE_SCANNER_REQUEST_TIMEOUT_MS",
  60_000,
  1_000,
  120_000,
);

const client = new S3Client({
  endpoint: "https://storage.yandexcloud.net",
  region: "ru-central1",
  credentials: {
    accessKeyId: requireSecretEnv("YANDEX_STORAGE_ACCESS_KEY_ID"),
    secretAccessKey: requireSecretEnv("YANDEX_STORAGE_SECRET_ACCESS_KEY"),
  },
});

async function verifyFixture(objectKey: string, expectedVerdict: MalwareScanVerdict) {
  let metadata;
  try {
    metadata = await client.send(
      new HeadObjectCommand({ Bucket: target.storageBucket, Key: objectKey }),
    );
  } catch (error) {
    const status = errorStatus(error);
    fail(`S3 fixture metadata verification failed (${errorName(error)}${status ? `:${status}` : ""})`);
  }

  const sizeBytes = metadata.ContentLength ?? 0;
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_FIXTURE_BYTES) {
    fail("fixture size is outside the allowed smoke-test range");
  }
  const mimeType = metadata.ContentType?.trim() || "application/octet-stream";
  if (mimeType.length > 200 || /[\r\n\0]/.test(mimeType)) {
    fail("fixture Content-Type is invalid");
  }

  let sourceUrl: string;
  try {
    sourceUrl = await getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: target.storageBucket, Key: objectKey }),
      { expiresIn: FIXTURE_URL_TTL_SECONDS },
    );
  } catch {
    fail("could not sign staging fixture URL");
  }

  let verdict: MalwareScanVerdict;
  try {
    const result = await scanWithHttpMalwareScanner(
      {
        origin: target.scannerOrigin,
        secret: target.scannerSecret,
        requestTimeoutMs: scannerTimeoutMs,
      },
      {
        sourceUrl,
        mimeType,
        sizeBytes: BigInt(sizeBytes),
      },
    );
    verdict = result.verdict;
  } catch (error) {
    const safeCode =
      error instanceof MalwareScannerError
        ? error.code
        : "SCANNER_UNEXPECTED_ERROR";
    fail(safeCode);
  }

  if (verdict !== expectedVerdict) {
    fail(`unexpected fixture verdict; expected ${expectedVerdict}`);
  }
}

try {
  await verifyFixture(target.cleanObjectKey, "CLEAN");
  await verifyFixture(target.maliciousObjectKey, "MALICIOUS");

  console.log("Staging malware scanner target guard verified");
  console.log("Dedicated private scanner fixtures verified: 2");
  console.log("Expected CLEAN verdict verified: 1");
  console.log("Expected MALICIOUS verdict verified: 1");
  console.log("Application database/client-case data accessed: 0");
  console.log("Fixture object keys or signed URLs logged: 0");
  console.log("Object mutations/listing performed by verifier: 0");
  console.log("STAGING_FILE_SCANNER_VERIFY_PASS");
} finally {
  client.destroy();
}
