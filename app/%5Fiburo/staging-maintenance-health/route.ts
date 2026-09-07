import { NextResponse } from "next/server";

import { getAiAuditHealthService } from "@/server/ai/audit-health-runtime";
import { readMaintenanceRuntimeConfig } from "@/server/config/production";
import {
  VERCEL_STAGING_BRANCH,
  isVercelPreviewBackendAllowed,
} from "@/server/config/vercel-preview-boundary";
import { readStoredFileDeletionHealthConfig } from "@/server/files/deletion-health-config";
import { getStoredFileDeletionHealthService } from "@/server/files/deletion-health-runtime";
import { getStoredFileScanHealthService } from "@/server/files/scan-health-runtime";
import { getStaleUploadHealthService } from "@/server/files/stale-upload-health-runtime";
import { getNotificationDeliveryHealthService } from "@/server/notifications/delivery-health-runtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const EXACT_GIT_SHA_PATTERN = /^[a-f0-9]{40}$/i;
const CONFIRM_HEADER = "x-iburo-staging-maintenance-health-confirm";
const CONFIG_ONLY_SECRET = "x".repeat(32);

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
      },
      aiAudit: {
        healthy: aiAudit.orphanCount === 0,
        orphanCount: aiAudit.orphanCount,
      },
    };
    const pass = Object.values(jobs).every((job) => job.healthy === true);

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
        jobs,
      },
      { status: pass ? 200 : 503, headers: NO_STORE_HEADERS },
    );
  } catch {
    return unavailable(502, "STAGING_MAINTENANCE_HEALTH_FAILED");
  }
}
