import { NextResponse } from "next/server";

import { getPrismaClient } from "@/server/database/prisma";
import {
  VERCEL_STAGING_BRANCH,
  isVercelPreviewBackendAllowed,
} from "@/server/config/vercel-preview-boundary";
import {
  TECHNICAL_E2E_CLIENT,
  TECHNICAL_E2E_MUTATION_CASE_NUMBER,
} from "@/server/staging/technical-e2e-fixture";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const EXACT_GIT_SHA_PATTERN = /^[a-f0-9]{40}$/i;
const KNOWN_FIXTURE_NAMES = ["iburo-staging-e2e.pdf", "iburo-staging-file-lifecycle.pdf"] as const;
const FIXTURE_MIME_TYPE = "application/pdf";
const EXPECTED_STORAGE_PROVIDER = "vercel-blob";

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
      operation: "staging-file-scan-backlog-classifier",
      available: false,
      ...(errorCode ? { errorCode } : {}),
    },
    { status, headers: NO_STORE_HEADERS },
  );
}

export async function GET() {
  const env = process.env;
  const commitSha = exactPreviewCommitSha(env);
  if (!isExactStagingPreview(env) || !commitSha) {
    return unavailable();
  }

  const prisma = getPrismaClient();
  const now = new Date();
  const cutoff30m = new Date(now.getTime() - 30 * 60_000);
  const cutoff6h = new Date(now.getTime() - 6 * 60 * 60_000);
  const cutoff24h = new Date(now.getTime() - 24 * 60 * 60_000);
  const cutoff7d = new Date(now.getTime() - 7 * 24 * 60 * 60_000);

  try {
    const aggregate = await prisma.$transaction(
      async (tx) => {
        const [technicalClient, technicalCase] = await Promise.all([
          tx.user.findUnique({
            where: { email: TECHNICAL_E2E_CLIENT.email },
            select: { id: true },
          }),
          tx.clientCase.findUnique({
            where: { caseNumber: TECHNICAL_E2E_MUTATION_CASE_NUMBER },
            select: { id: true, clientId: true },
          }),
        ]);

        const technicalIdentityValid = Boolean(
          technicalClient && technicalCase && technicalCase.clientId === technicalClient.id,
        );

        const strictTechnicalWhere =
          technicalIdentityValid && technicalClient && technicalCase
            ? {
                clientCaseId: technicalCase.id,
                uploadedById: technicalClient.id,
                status: "PENDING_SCAN" as const,
                fileName: { in: [...KNOWN_FIXTURE_NAMES] },
                mimeType: FIXTURE_MIME_TYPE,
                storageProvider: EXPECTED_STORAGE_PROVIDER,
                objectKey: { startsWith: `cases/${technicalCase.id}/` },
              }
            : null;

        const [
          pendingScan,
          scanning,
          scanFailed,
          quarantined,
          pendingRecent,
          pending30mTo6h,
          pending6hTo24h,
          pending1dTo7d,
          pendingOlderThan7d,
          pendingDue,
          pendingScheduledFuture,
          pendingUnscheduled,
          pendingAttemptZero,
          pendingAttemptOneToTwo,
          pendingAttemptThreePlus,
          strictTechnicalFixtures,
        ] = await Promise.all([
          tx.storedFile.count({ where: { status: "PENDING_SCAN" } }),
          tx.storedFile.count({ where: { status: "SCANNING" } }),
          tx.storedFile.count({ where: { status: "SCAN_FAILED" } }),
          tx.storedFile.count({ where: { status: "QUARANTINED" } }),
          tx.storedFile.count({
            where: { status: "PENDING_SCAN", createdAt: { gt: cutoff30m } },
          }),
          tx.storedFile.count({
            where: {
              status: "PENDING_SCAN",
              createdAt: { gt: cutoff6h, lte: cutoff30m },
            },
          }),
          tx.storedFile.count({
            where: {
              status: "PENDING_SCAN",
              createdAt: { gt: cutoff24h, lte: cutoff6h },
            },
          }),
          tx.storedFile.count({
            where: {
              status: "PENDING_SCAN",
              createdAt: { gt: cutoff7d, lte: cutoff24h },
            },
          }),
          tx.storedFile.count({
            where: { status: "PENDING_SCAN", createdAt: { lte: cutoff7d } },
          }),
          tx.storedFile.count({
            where: { status: "PENDING_SCAN", scanNextAttemptAt: { lte: now } },
          }),
          tx.storedFile.count({
            where: { status: "PENDING_SCAN", scanNextAttemptAt: { gt: now } },
          }),
          tx.storedFile.count({
            where: { status: "PENDING_SCAN", scanNextAttemptAt: null },
          }),
          tx.storedFile.count({
            where: { status: "PENDING_SCAN", scanAttemptCount: 0 },
          }),
          tx.storedFile.count({
            where: { status: "PENDING_SCAN", scanAttemptCount: { gte: 1, lte: 2 } },
          }),
          tx.storedFile.count({
            where: { status: "PENDING_SCAN", scanAttemptCount: { gte: 3 } },
          }),
          strictTechnicalWhere ? tx.storedFile.count({ where: strictTechnicalWhere }) : 0,
        ]);

        return {
          technicalIdentityValid,
          pendingScan,
          scanning,
          scanFailed,
          quarantined,
          pendingRecent,
          pending30mTo6h,
          pending6hTo24h,
          pending1dTo7d,
          pendingOlderThan7d,
          pendingDue,
          pendingScheduledFuture,
          pendingUnscheduled,
          pendingAttemptZero,
          pendingAttemptOneToTwo,
          pendingAttemptThreePlus,
          strictTechnicalFixtures,
        };
      },
      { isolationLevel: "RepeatableRead" },
    );

    const unknownOrNonTechnical = Math.max(
      0,
      aggregate.pendingScan - aggregate.strictTechnicalFixtures,
    );

    return NextResponse.json(
      {
        service: "iburo127",
        operation: "staging-file-scan-backlog-classifier",
        environment: "preview",
        branch: VERCEL_STAGING_BRANCH,
        commitSha,
        runtimeTarget: "staging",
        pass: true,
        readOnly: true,
        aggregateOnly: true,
        snapshotIsolation: "REPEATABLE_READ",
        valuesPrinted: false,
        statuses: {
          pendingScan: aggregate.pendingScan,
          scanning: aggregate.scanning,
          scanFailed: aggregate.scanFailed,
          quarantined: aggregate.quarantined,
        },
        pendingAge: {
          under30Minutes: aggregate.pendingRecent,
          from30MinutesTo6Hours: aggregate.pending30mTo6h,
          from6To24Hours: aggregate.pending6hTo24h,
          from1To7Days: aggregate.pending1dTo7d,
          olderThan7Days: aggregate.pendingOlderThan7d,
        },
        pendingSchedule: {
          dueOrOverdue: aggregate.pendingDue,
          scheduledFuture: aggregate.pendingScheduledFuture,
          unscheduled: aggregate.pendingUnscheduled,
        },
        pendingAttempts: {
          zero: aggregate.pendingAttemptZero,
          oneToTwo: aggregate.pendingAttemptOneToTwo,
          threeOrMore: aggregate.pendingAttemptThreePlus,
        },
        provenance: {
          technicalIdentityValid: aggregate.technicalIdentityValid,
          strictKnownTechnicalFixtures: aggregate.strictTechnicalFixtures,
          unknownOrNonTechnical,
        },
      },
      { status: 200, headers: NO_STORE_HEADERS },
    );
  } catch {
    return unavailable(502, "STAGING_FILE_SCAN_BACKLOG_CLASSIFIER_FAILED");
  }
}
