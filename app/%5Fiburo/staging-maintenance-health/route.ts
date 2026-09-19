import { NextResponse } from "next/server";

import { buildStagingEnvironmentInventory } from "@/scripts/staging-environment-inventory";
import { getAiAuditHealthService } from "@/server/ai/audit-health-runtime";
import { readMaintenanceRuntimeConfig } from "@/server/config/production";
import {
  VERCEL_STAGING_BRANCH,
  isVercelPreviewBackendAllowed,
} from "@/server/config/vercel-preview-boundary";
import { getPrismaClient } from "@/server/database/prisma";
import { readStoredFileDeletionHealthConfig } from "@/server/files/deletion-health-config";
import { getStoredFileDeletionHealthService } from "@/server/files/deletion-health-runtime";
import { readStoredFileDeletionMode } from "@/server/files/deletion-mode";
import { getStoredFileScanHealthService } from "@/server/files/scan-health-runtime";
import { getStaleUploadHealthService } from "@/server/files/stale-upload-health-runtime";
import { getNotificationDeliveryHealthService } from "@/server/notifications/delivery-health-runtime";
import {
  TECHNICAL_E2E_CLIENT,
  TECHNICAL_E2E_MUTATION_CASE_NUMBER,
} from "@/server/staging/technical-e2e-fixture";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const EXACT_GIT_SHA_PATTERN = /^[a-f0-9]{40}$/i;
const CONFIRM_HEADER = "x-iburo-staging-maintenance-health-confirm";
const CONFIG_ONLY_SECRET = "x".repeat(32);
const TECHNICAL_FILE_NAMES = new Set([
  "iburo-staging-e2e.pdf",
  "iburo-staging-file-lifecycle.pdf",
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

function isExactStagingPreview(env: NodeJS.ProcessEnv): boolean {
  return (
    env.VERCEL_ENV?.trim() === "preview" &&
    env.VERCEL_GIT_COMMIT_REF?.trim() === VERCEL_STAGING_BRANCH &&
    env.IB_RUNTIME_TARGET?.trim() === "staging" &&
    exactPreviewCommitSha(env) !== null &&
    isVercelPreviewBackendAllowed(env)
  );
}

function unavailable(status = 404, errorCode?: string) {
  return NextResponse.json(
    {
      service: "iburo127",
      operation: "staging-maintenance-health",
      available: false,
      ...(errorCode ? { errorCode } : {}),
    },
    { status, headers: NO_STORE_HEADERS },
  );
}

function ageMinutes(now: Date, value: Date | null) {
  if (!value) return null;
  return Math.max(0, Math.floor((now.getTime() - value.getTime()) / 60_000));
}

function safeErrorCode(value: string | null) {
  if (!value) return null;
  return /^[A-Z0-9_:-]{1,80}$/.test(value) ? value : "REDACTED";
}

export async function POST(request: Request) {
  const env = process.env;
  const commitSha = exactPreviewCommitSha(env);
  if (
    !isExactStagingPreview(env) ||
    !commitSha ||
    request.headers.get(CONFIRM_HEADER) !== `RUN_STAGING_MAINTENANCE_HEALTH:${commitSha}`
  ) {
    return unavailable();
  }

  try {
    // The staging proof does not authenticate or invoke maintenance HTTP routes.
    // A process-local sentinel is supplied only so the canonical config parser can
    // validate the same numeric health thresholds without requiring the real secret.
    const config = readMaintenanceRuntimeConfig({
      ...env,
      IB_MAINTENANCE_SECRET: CONFIG_ONLY_SECRET,
    });
    const inventory = buildStagingEnvironmentInventory(env);
    let durableDeletionMode = false;
    try {
      durableDeletionMode = readStoredFileDeletionMode(env) === "durable";
    } catch {
      // An invalid deletion mode must never satisfy the staging release gate.
    }
    const configuration = {
      maintenance: inventory.phases.maintenance.ready,
      scanner: inventory.phases.scanner.ready,
      fileDeletion: durableDeletionMode && inventory.phases.maintenance.ready,
    };
    const deletionConfig = readStoredFileDeletionHealthConfig(env);
    const now = new Date();

    const [notificationDelivery, staleUploads, fileScans, fileDeletion, aiAudit] =
      await Promise.all([
        getNotificationDeliveryHealthService().inspect({
          now,
          graceMinutes: config.notificationDeliveryHealthGraceMinutes,
          limit: config.notificationDeliveryHealthBatchLimit,
        }),
        getStaleUploadHealthService().inspect({
          now,
          maxAgeMinutes: config.staleUploadMaxAgeMinutes,
          graceMinutes: config.staleUploadHealthGraceMinutes,
          limit: config.staleUploadHealthBatchLimit,
        }),
        getStoredFileScanHealthService().inspect({
          now,
          graceMinutes: config.fileScanHealthGraceMinutes,
          limit: config.fileScanHealthBatchLimit,
        }),
        getStoredFileDeletionHealthService().inspect({
          now,
          graceMinutes: deletionConfig.graceMinutes,
          limit: deletionConfig.batchLimit,
        }),
        getAiAuditHealthService().check({
          now,
          graceMinutes: config.aiAuditGraceMinutes,
          limit: config.aiAuditBatchLimit,
        }),
      ]);

    // Read-only, redacted diagnosis for the two singleton backlog counters. The
    // response deliberately omits record ids, object keys, names, user data and URLs.
    const prisma = getPrismaClient();
    const staleUploadOverdueBefore = new Date(
      now.getTime() -
        (config.staleUploadMaxAgeMinutes + config.staleUploadHealthGraceMinutes) * 60_000,
    );
    const deletionOverdueBefore = new Date(
      now.getTime() - deletionConfig.graceMinutes * 60_000,
    );

    const [staleUploadRow, deletionRow] = await Promise.all([
      prisma.storedFile.findFirst({
        where: {
          status: "PENDING_UPLOAD",
          createdAt: { lte: staleUploadOverdueBefore },
        },
        select: {
          storageProvider: true,
          fileName: true,
          checksumSha256: true,
          createdAt: true,
          uploadedBy: { select: { email: true } },
          clientCase: { select: { caseNumber: true } },
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      }),
      prisma.storedFileDeletion.findFirst({
        where: {
          status: "PENDING",
          nextAttemptAt: { lte: deletionOverdueBefore },
        },
        select: {
          clientCaseId: true,
          requestedByUserId: true,
          storageProvider: true,
          originalFileStatus: true,
          attemptCount: true,
          nextAttemptAt: true,
          leaseUntil: true,
          lastErrorCode: true,
          requestedAt: true,
          storageConfirmedAt: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: [{ nextAttemptAt: "asc" }, { createdAt: "asc" }],
      }),
    ]);

    const deletionContext = deletionRow
      ? await Promise.all([
          prisma.clientCase.findUnique({
            where: { id: deletionRow.clientCaseId },
            select: { caseNumber: true },
          }),
          prisma.user.findUnique({
            where: { id: deletionRow.requestedByUserId },
            select: { email: true },
          }),
        ])
      : null;

    const staleUploadDiagnostic = staleUploadRow
      ? {
          present: true,
          technicalFixture:
            staleUploadRow.clientCase.caseNumber === TECHNICAL_E2E_MUTATION_CASE_NUMBER &&
            staleUploadRow.uploadedBy?.email === TECHNICAL_E2E_CLIENT.email &&
            TECHNICAL_FILE_NAMES.has(staleUploadRow.fileName),
          technicalFileName: TECHNICAL_FILE_NAMES.has(staleUploadRow.fileName),
          provider: staleUploadRow.storageProvider,
          ageMinutes: ageMinutes(now, staleUploadRow.createdAt),
          checksumPresent: staleUploadRow.checksumSha256 !== null,
        }
      : { present: false };

    const deletionDiagnostic = deletionRow
      ? {
          present: true,
          technicalFixture:
            deletionContext?.[0]?.caseNumber === TECHNICAL_E2E_MUTATION_CASE_NUMBER &&
            deletionContext?.[1]?.email === TECHNICAL_E2E_CLIENT.email,
          provider: deletionRow.storageProvider,
          originalFileStatus: deletionRow.originalFileStatus,
          attemptCount: deletionRow.attemptCount,
          nextAttemptOverdueMinutes: ageMinutes(now, deletionRow.nextAttemptAt),
          requestedAgeMinutes: ageMinutes(now, deletionRow.requestedAt),
          createdAgeMinutes: ageMinutes(now, deletionRow.createdAt),
          updatedAgeMinutes: ageMinutes(now, deletionRow.updatedAt),
          leasePresent: deletionRow.leaseUntil !== null,
          storageConfirmed: deletionRow.storageConfirmedAt !== null,
          lastErrorCode: safeErrorCode(deletionRow.lastErrorCode),
        }
      : { present: false };

    const jobs = {
      notificationDelivery: {
        healthy: notificationDelivery.healthy,
        overduePending: notificationDelivery.overduePending,
        expiredLeases: notificationDelivery.expiredLeases,
        dead: notificationDelivery.dead,
        saturated: notificationDelivery.saturated,
      },
      staleUploads: {
        healthy: staleUploads.healthy,
        overdue: staleUploads.overdue,
        saturated: staleUploads.saturated,
        diagnostic: staleUploadDiagnostic,
      },
      fileScans: {
        healthy: fileScans.healthy,
        overduePending: fileScans.overduePending,
        expiredLeases: fileScans.expiredLeases,
        terminalFailures: fileScans.terminalFailures,
        saturated: fileScans.saturated,
      },
      fileDeletion: {
        healthy: fileDeletion.healthy,
        overduePending: fileDeletion.overduePending,
        expiredLeases: fileDeletion.expiredLeases,
        attentionRequired: fileDeletion.attentionRequired,
        saturated: fileDeletion.saturated,
        diagnostic: deletionDiagnostic,
      },
      aiAudit: {
        healthy: aiAudit.orphanCount === 0,
        orphanCount: aiAudit.orphanCount,
      },
    };
    const pass =
      Object.values(jobs).every((job) => job.healthy === true) &&
      Object.values(configuration).every((ready) => ready === true);

    return NextResponse.json(
      {
        service: "iburo127",
        operation: "staging-maintenance-health",
        environment: "preview",
        branch: VERCEL_STAGING_BRANCH,
        commitSha,
        runtimeTarget: "staging",
        pass,
        aggregateOnly: true,
        valuesPrinted: false,
        configuration,
        jobs,
      },
      { status: pass ? 200 : 503, headers: NO_STORE_HEADERS },
    );
  } catch {
    return unavailable(502, "STAGING_MAINTENANCE_HEALTH_FAILED");
  }
}
