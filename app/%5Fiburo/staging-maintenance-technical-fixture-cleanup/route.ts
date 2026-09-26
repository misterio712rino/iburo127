import { NextResponse } from "next/server";

import { readMaintenanceRuntimeConfig } from "@/server/config/production";
import {
  VERCEL_STAGING_BRANCH,
  isVercelPreviewBackendAllowed,
} from "@/server/config/vercel-preview-boundary";
import { getPrismaClient } from "@/server/database/prisma";
import { readStoredFileDeletionHealthConfig } from "@/server/files/deletion-health-config";
import { getStoredFileDeletionWorker } from "@/server/files/deletion-worker-runtime";
import { getPrivateObjectStorage } from "@/server/files/object-storage-runtime";
import { PrismaStoredFileRepository } from "@/server/repositories/prisma/stored-file-repository";
import {
  TECHNICAL_E2E_CLIENT,
  TECHNICAL_E2E_MUTATION_CASE_NUMBER,
} from "@/server/staging/technical-e2e-fixture";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const EXACT_GIT_SHA_PATTERN = /^[a-f0-9]{40}$/i;
const CONFIG_ONLY_SECRET = "x".repeat(32);
const CONFIRM_HEADER = "x-iburo-staging-maintenance-cleanup-confirm";
const EXPECTED_STALE_HEADER = "x-iburo-staging-maintenance-cleanup-stale";
const EXPECTED_DELETION_HEADER = "x-iburo-staging-maintenance-cleanup-deletion";
const FIXTURE_NAMES = ["iburo-staging-e2e.pdf", "iburo-staging-file-lifecycle.pdf"] as const;
const FIXTURE_MIME_TYPE = "application/pdf";
const EXPECTED_STORAGE_PROVIDER = "vercel-blob";
const MAX_STALE = 100;
const MAX_DELETION = 20;

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

function parseExpected(value: string | null, max: number): number | null {
  if (!value || !/^\d{1,3}$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= max ? parsed : null;
}

function unavailable(status = 404, errorCode?: string) {
  return NextResponse.json(
    {
      service: "iburo127",
      operation: "staging-maintenance-technical-fixture-cleanup",
      pass: false,
      ...(errorCode ? { errorCode } : {}),
    },
    { status, headers: NO_STORE_HEADERS },
  );
}

export async function POST(request: Request) {
  const env = process.env;
  const commitSha = exactPreviewCommitSha(env);
  const expectedStale = parseExpected(request.headers.get(EXPECTED_STALE_HEADER), MAX_STALE);
  const expectedDeletion = parseExpected(
    request.headers.get(EXPECTED_DELETION_HEADER),
    MAX_DELETION,
  );
  if (
    !isExactStagingPreview(env) ||
    !commitSha ||
    expectedStale === null ||
    expectedDeletion === null ||
    request.headers.get(CONFIRM_HEADER) !==
      `CLEAN_TECHNICAL_MAINTENANCE_FIXTURES:${commitSha}:${expectedStale}:${expectedDeletion}`
  ) {
    return unavailable();
  }

  try {
    const config = readMaintenanceRuntimeConfig({
      ...env,
      IB_MAINTENANCE_SECRET: CONFIG_ONLY_SECRET,
    });
    const deletionConfig = readStoredFileDeletionHealthConfig(env);
    const now = new Date();
    const staleBefore = new Date(
      now.getTime() -
        (config.staleUploadMaxAgeMinutes + config.staleUploadHealthGraceMinutes) * 60_000,
    );
    const deletionBefore = new Date(
      now.getTime() - deletionConfig.graceMinutes * 60_000,
    );
    const prisma = getPrismaClient();
    const storage = getPrivateObjectStorage();
    const storedFileRepository = new PrismaStoredFileRepository();

    const [technicalClient, technicalCase] = await Promise.all([
      prisma.user.findUnique({
        where: { email: TECHNICAL_E2E_CLIENT.email },
        select: { id: true },
      }),
      prisma.clientCase.findUnique({
        where: { caseNumber: TECHNICAL_E2E_MUTATION_CASE_NUMBER },
        select: { id: true, clientId: true },
      }),
    ]);
    if (!technicalClient || !technicalCase || technicalCase.clientId !== technicalClient.id) {
      return unavailable(409, "TECHNICAL_FIXTURE_IDENTITY_MISMATCH");
    }

    const objectKeyPrefix = `cases/${technicalCase.id}/`;
    const staleBase = {
      status: "PENDING_UPLOAD" as const,
      createdAt: { lte: staleBefore },
    };
    const staleStrict = {
      ...staleBase,
      clientCaseId: technicalCase.id,
      uploadedById: technicalClient.id,
      fileName: { in: [...FIXTURE_NAMES] },
      mimeType: FIXTURE_MIME_TYPE,
      storageProvider: EXPECTED_STORAGE_PROVIDER,
      objectKey: { startsWith: objectKeyPrefix },
    };
    const deletionBase = {
      status: "PENDING" as const,
      nextAttemptAt: { lte: deletionBefore },
    };
    const deletionStrict = {
      ...deletionBase,
      clientCaseId: technicalCase.id,
      requestedByUserId: technicalClient.id,
      storageProvider: EXPECTED_STORAGE_PROVIDER,
      objectKey: { startsWith: objectKeyPrefix },
      originalFileStatus: "PENDING_SCAN" as const,
      attemptCount: 0,
      leaseUntil: null,
      storageConfirmedAt: null,
      lastErrorCode: null,
    };

    const [staleTotal, staleFiles, deletionTotal, deletionRows] = await Promise.all([
      prisma.storedFile.count({ where: staleBase }),
      prisma.storedFile.findMany({
        where: staleStrict,
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: MAX_STALE + 1,
      }),
      prisma.storedFileDeletion.count({ where: deletionBase }),
      prisma.storedFileDeletion.findMany({
        where: deletionStrict,
        select: { fileId: true },
        orderBy: [{ nextAttemptAt: "asc" }, { createdAt: "asc" }],
        take: MAX_DELETION + 1,
      }),
    ]);

    if (
      staleTotal !== expectedStale ||
      staleFiles.length !== expectedStale ||
      deletionTotal !== expectedDeletion ||
      deletionRows.length !== expectedDeletion
    ) {
      return unavailable(409, "TECHNICAL_FIXTURE_SNAPSHOT_MISMATCH");
    }

    let staleDeleted = 0;
    for (const file of staleFiles) {
      if (
        file.status !== "PENDING_UPLOAD" ||
        file.clientCaseId !== technicalCase.id ||
        file.uploadedById !== technicalClient.id ||
        file.storageProvider !== storage.providerCode ||
        !file.objectKey.startsWith(objectKeyPrefix) ||
        !FIXTURE_NAMES.includes(file.fileName as (typeof FIXTURE_NAMES)[number]) ||
        file.mimeType !== FIXTURE_MIME_TYPE
      ) {
        return unavailable(409, "TECHNICAL_STALE_FIXTURE_MISMATCH");
      }

      const claimed = await prisma.storedFile.deleteMany({
        where: {
          id: file.id,
          status: "PENDING_UPLOAD",
          clientCaseId: technicalCase.id,
          uploadedById: technicalClient.id,
          storageProvider: EXPECTED_STORAGE_PROVIDER,
          objectKey: file.objectKey,
          fileName: file.fileName,
          mimeType: FIXTURE_MIME_TYPE,
          createdAt: { lte: staleBefore },
        },
      });
      if (claimed.count !== 1) {
        return unavailable(409, "TECHNICAL_STALE_FIXTURE_CONFLICT");
      }

      try {
        await storage.deleteObject(file.objectKey);
      } catch {
        const restored = await storedFileRepository.restorePending(file);
        if (!restored) {
          return unavailable(500, "TECHNICAL_STALE_FIXTURE_RESTORE_FAILED");
        }
        return unavailable(503, "TECHNICAL_STALE_FIXTURE_STORAGE_RETRY");
      }
      staleDeleted += 1;
    }

    let deletionCompleted = 0;
    const deletionWorker = getStoredFileDeletionWorker();
    for (const deletion of deletionRows) {
      const result = await deletionWorker.runBatch({
        now: new Date(),
        limit: 1,
        fileId: deletion.fileId,
      });
      if (
        result.claimed !== 1 ||
        result.completed !== 1 ||
        result.retried !== 0 ||
        result.requiresAttention !== 0 ||
        result.leaseLost !== 0 ||
        result.finalizationDeferred !== 0
      ) {
        return unavailable(503, "TECHNICAL_DELETION_FIXTURE_NOT_COMPLETED");
      }
      deletionCompleted += 1;
    }

    return NextResponse.json(
      {
        service: "iburo127",
        operation: "staging-maintenance-technical-fixture-cleanup",
        environment: "preview",
        branch: VERCEL_STAGING_BRANCH,
        commitSha,
        runtimeTarget: "staging",
        pass: true,
        aggregateOnly: true,
        valuesPrinted: false,
        expected: {
          staleUploads: expectedStale,
          fileDeletion: expectedDeletion,
        },
        cleaned: {
          staleUploads: staleDeleted,
          fileDeletion: deletionCompleted,
        },
      },
      { status: 200, headers: NO_STORE_HEADERS },
    );
  } catch {
    return unavailable(502, "STAGING_MAINTENANCE_TECHNICAL_FIXTURE_CLEANUP_FAILED");
  }
}
