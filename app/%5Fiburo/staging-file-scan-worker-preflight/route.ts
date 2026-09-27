import { NextResponse } from "next/server";

import { readBoundedScannerJson } from "@/scripts/staging-scanner-bounded-json";

import {
  readFileScannerRuntimeConfig,
  readMaintenanceRuntimeConfig,
} from "@/server/config/production";
import {
  VERCEL_STAGING_BRANCH,
  isVercelPreviewBackendAllowed,
} from "@/server/config/vercel-preview-boundary";
import { getPrismaClient } from "@/server/database/prisma";
import { getPrivateObjectStorage } from "@/server/files/object-storage-runtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const EXACT_GIT_SHA_PATTERN = /^[a-f0-9]{40}$/i;
const CONFIRM_HEADER = "x-iburo-staging-file-scan-worker-preflight-confirm";
const CONFIG_ONLY_SECRET = "x".repeat(32);
const EXPECTED_STORAGE_PROVIDER = "vercel-blob";
const MAX_SCANNER_FILE_BYTES = BigInt(52_428_800);
const ALLOWED_SCANNER_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex",
};

function exactPreviewCommitSha(env: NodeJS.ProcessEnv): string | null {
  const value = env.VERCEL_GIT_COMMIT_SHA?.trim();
  return value && EXACT_GIT_SHA_PATTERN.test(value) ? value.toLowerCase() : null;
}

function isExactStagingPreview(env: NodeJS.ProcessEnv) {
  return (
    env.VERCEL_ENV?.trim() === "preview" &&
    env.VERCEL_GIT_COMMIT_REF?.trim() === VERCEL_STAGING_BRANCH &&
    env.IB_RUNTIME_TARGET?.trim() === "staging" &&
    exactPreviewCommitSha(env) !== null &&
    isVercelPreviewBackendAllowed(env)
  );
}

function configuredSecret(value: string | undefined) {
  const secret = value?.trim() ?? "";
  return secret.length >= 32 && !/[\r\n\0]/.test(secret);
}

function configuredOrigin(value: string | undefined) {
  const raw = value?.trim();
  if (!raw) return false;
  try {
    const parsed = new URL(raw);
    return (
      parsed.protocol === "https:" &&
      parsed.origin === raw &&
      (parsed.pathname === "/" || parsed.pathname === "") &&
      !parsed.search &&
      !parsed.hash &&
      !parsed.username &&
      !parsed.password
    );
  } catch {
    return false;
  }
}

function unavailable(status = 404, errorCode?: string) {
  return NextResponse.json(
    {
      service: "iburo127",
      operation: "staging-file-scan-worker-preflight",
      available: false,
      ...(errorCode ? { errorCode } : {}),
    },
    { status, headers: NO_STORE_HEADERS },
  );
}

type ScannerHealthResult = {
  healthy: boolean;
  httpStatus: number | null;
  responseErrorCode: "UNAUTHORIZED" | "REQUEST_FAILED" | null;
  contentTypeMatches: boolean | null;
};

function safeScannerResponseErrorCode(
  value: unknown,
): ScannerHealthResult["responseErrorCode"] {
  if (value === "UNAUTHORIZED" || value === "REQUEST_FAILED") return value;
  return null;
}

async function scannerHealth(
  origin: string,
  secret: string,
  timeoutMs: number,
): Promise<ScannerHealthResult> {
  let response: Response;
  try {
    response = await fetch(`${origin}/health`, {
      method: "GET",
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(Math.min(timeoutMs, 15_000)),
      headers: {
        Authorization: `Bearer ${secret}`,
        Accept: "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return {
      healthy: false,
      httpStatus: null,
      responseErrorCode: "REQUEST_FAILED",
      contentTypeMatches: null,
    };
  }

  const contentType =
    response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  const contentTypeMatches = contentType === "application/json";
  if (response.status !== 200 || !contentTypeMatches) {
    let responseErrorCode: ScannerHealthResult["responseErrorCode"] = null;
    if (contentTypeMatches) {
      try {
        const body = await readBoundedScannerJson(response, 128);
        if (
          body !== null &&
          typeof body === "object" &&
          !Array.isArray(body) &&
          Object.keys(body as Record<string, unknown>).length === 1
        ) {
          responseErrorCode = safeScannerResponseErrorCode(
            (body as { error?: unknown }).error,
          );
        }
      } catch {
        // Keep only the bounded status and whitelisted response code.
      }
    } else {
      await response.body?.cancel().catch(() => {});
    }
    return {
      healthy: false,
      httpStatus: response.status,
      responseErrorCode,
      contentTypeMatches,
    };
  }

  let body: unknown;
  try {
    body = await readBoundedScannerJson(response, 128);
  } catch {
    return {
      healthy: false,
      httpStatus: response.status,
      responseErrorCode: null,
      contentTypeMatches,
    };
  }
  const healthy =
    body !== null &&
    typeof body === "object" &&
    !Array.isArray(body) &&
    Object.keys(body as Record<string, unknown>).length === 1 &&
    (body as { status?: unknown }).status === "ok";
  return {
    healthy,
    httpStatus: response.status,
    responseErrorCode: null,
    contentTypeMatches,
  };
}
export async function POST(request: Request) {
  const env = process.env;
  const commitSha = exactPreviewCommitSha(env);
  if (
    !isExactStagingPreview(env) ||
    !commitSha ||
    request.headers.get(CONFIRM_HEADER) !== `PREFLIGHT_STAGING_FILE_SCAN_WORKER:${commitSha}`
  ) {
    return unavailable();
  }

  try {
    const maintenance = readMaintenanceRuntimeConfig({
      ...env,
      IB_MAINTENANCE_SECRET: CONFIG_ONLY_SECRET,
    });
    const scanner = readFileScannerRuntimeConfig(env);
    const storage = getPrivateObjectStorage();
    const prisma = getPrismaClient();
    const now = new Date();

    const [pending, dueOrOverdue, unscheduled, zeroAttempts, attempted, scanning, expiredScanning] =
      await Promise.all([
      prisma.storedFile.count({ where: { status: "PENDING_SCAN" } }),
      prisma.storedFile.count({
        where: {
          status: "PENDING_SCAN",
          scanNextAttemptAt: { lte: now },
        },
      }),
      prisma.storedFile.count({
        where: {
          status: "PENDING_SCAN",
          scanNextAttemptAt: null,
        },
      }),
      prisma.storedFile.count({
        where: {
          status: "PENDING_SCAN",
          scanAttemptCount: 0,
        },
      }),
      prisma.storedFile.count({
        where: {
          status: "PENDING_SCAN",
          scanAttemptCount: { gt: 0 },
        },
      }),
      prisma.storedFile.count({ where: { status: "SCANNING" } }),
      prisma.storedFile.count({
        where: {
          status: "SCANNING",
          scanLeaseUntil: { lte: now },
        },
      }),
    ]);

    const candidate = await prisma.storedFile.findFirst({
      where: {
        status: "PENDING_SCAN",
        scanNextAttemptAt: { lte: now },
      },
      select: {
        storageProvider: true,
        objectKey: true,
        mimeType: true,
        sizeBytes: true,
        scanAttemptCount: true,
      },
      orderBy: [{ scanNextAttemptAt: "asc" }, { createdAt: "asc" }],
    });

    let candidateMetadata: Awaited<ReturnType<typeof storage.statObject>> = null;
    let candidateMetadataReadError = false;
    if (candidate) {
      try {
        candidateMetadata = await storage.statObject(candidate.objectKey);
      } catch {
        candidateMetadataReadError = true;
      }
    }

    const candidatePresent = candidate !== null;
    const candidateProviderMatches =
      candidate !== null && candidate.storageProvider === storage.providerCode;
    const candidateAttemptIsZero = candidate !== null && candidate.scanAttemptCount === 0;
    const candidateMimeAllowed =
      candidate !== null && ALLOWED_SCANNER_MIME_TYPES.has(candidate.mimeType);
    const candidateSizeAllowed =
      candidate !== null &&
      candidate.sizeBytes > BigInt(0) &&
      candidate.sizeBytes <= MAX_SCANNER_FILE_BYTES;
    const candidateObjectExists = candidateMetadata !== null;
    const candidateObjectSizeMatches =
      candidate !== null &&
      candidateMetadata !== null &&
      candidateMetadata.sizeBytes === candidate.sizeBytes;
    const candidateObjectMimeMatches =
      candidate !== null &&
      candidateMetadata !== null &&
      candidateMetadata.mimeType === candidate.mimeType;
    const candidateReady =
      candidatePresent &&
      candidateProviderMatches &&
      candidateAttemptIsZero &&
      candidateMimeAllowed &&
      candidateSizeAllowed &&
      !candidateMetadataReadError &&
      candidateObjectExists &&
      candidateObjectSizeMatches &&
      candidateObjectMimeMatches;

    const health = await scannerHealth(scanner.origin, scanner.secret, scanner.requestTimeoutMs);
    const leaseTimeoutCompatible =
      scanner.requestTimeoutMs < maintenance.fileScanLeaseSeconds * 1000;
    const sourceUrlTtlCompatible =
      maintenance.fileScanSourceUrlTtlSeconds >= maintenance.fileScanLeaseSeconds;
    const batchIsOne = maintenance.fileScanBatchLimit === 1;
    const storageProviderMatches = storage.providerCode === EXPECTED_STORAGE_PROVIDER;
    const noActiveScans = scanning === 0 && expiredScanning === 0;
    const workerConfigPass =
      health.healthy &&
      leaseTimeoutCompatible &&
      sourceUrlTtlCompatible &&
      batchIsOne &&
      storageProviderMatches &&
      noActiveScans &&
      candidateReady;

    const standardMaintenanceEndpointConfigured =
      configuredSecret(env.IB_MAINTENANCE_SECRET) &&
      configuredOrigin(env.IB_MAINTENANCE_BASE_URL);

    return NextResponse.json(
      {
        service: "iburo127",
        operation: "staging-file-scan-worker-preflight",
        environment: "preview",
        branch: VERCEL_STAGING_BRANCH,
        commitSha,
        runtimeTarget: "staging",
        pass: workerConfigPass,
        readOnly: true,
        networkAccessed: true,
        valuesPrinted: false,
        scanner: {
          healthy: health.healthy,
          httpStatus: health.httpStatus,
          responseErrorCode: health.responseErrorCode,
          contentTypeMatches: health.contentTypeMatches,
          requestTimeoutMs: scanner.requestTimeoutMs,
        },
        storage: {
          provider: storage.providerCode,
          expectedProvider: EXPECTED_STORAGE_PROVIDER,
          providerMatches: storageProviderMatches,
        },
        candidate: {
          present: candidatePresent,
          providerMatches: candidateProviderMatches,
          attemptIsZero: candidateAttemptIsZero,
          mimeAllowed: candidateMimeAllowed,
          sizeAllowed: candidateSizeAllowed,
          metadataReadError: candidateMetadataReadError,
          objectExists: candidateObjectExists,
          objectSizeMatches: candidateObjectSizeMatches,
          objectMimeMatches: candidateObjectMimeMatches,
          ready: candidateReady,
        },
        worker: {
          batchLimit: maintenance.fileScanBatchLimit,
          batchIsOne,
          leaseSeconds: maintenance.fileScanLeaseSeconds,
          sourceUrlTtlSeconds: maintenance.fileScanSourceUrlTtlSeconds,
          sourceUrlTtlCompatible,
          maxAttempts: maintenance.fileScanMaxAttempts,
          retryBaseSeconds: maintenance.fileScanRetryBaseSeconds,
          retryMaxSeconds: maintenance.fileScanRetryMaxSeconds,
          leaseTimeoutCompatible,
        },
        scheduler: {
          standardMaintenanceEndpointConfigured,
        },
        backlog: {
          pending,
          dueOrOverdue,
          unscheduled,
          zeroAttempts,
          attempted,
          scanning,
          expiredScanning,
          noActiveScans,
        },
      },
      { status: workerConfigPass ? 200 : 503, headers: NO_STORE_HEADERS },
    );
  } catch {
    return unavailable(502, "STAGING_FILE_SCAN_WORKER_PREFLIGHT_FAILED");
  }
}
