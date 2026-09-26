import { NextResponse } from "next/server";

import { readMaintenanceRuntimeConfig } from "@/server/config/production";
import { VERCEL_STAGING_BRANCH, isVercelPreviewBackendAllowed } from "@/server/config/vercel-preview-boundary";
import { getPrismaClient } from "@/server/database/prisma";
import { readStoredFileDeletionHealthConfig } from "@/server/files/deletion-health-config";
import {
  TECHNICAL_E2E_CLIENT,
  TECHNICAL_E2E_MUTATION_CASE_NUMBER,
} from "@/server/staging/technical-e2e-fixture";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const EXACT_GIT_SHA_PATTERN = /^[a-f0-9]{40}$/i;
const CONFIRM_HEADER = "x-iburo-staging-maintenance-backlog-classifier-confirm";
const CONFIG_ONLY_SECRET = "x".repeat(32);
const TECHNICAL_FILE_NAMES = new Set([
  "iburo-staging-e2e.pdf",
  "iburo-staging-file-lifecycle.pdf",
]);
const EXPECTED_PROVIDER = "vercel-blob";
const EXPECTED_MIME = "application/pdf";
const MAX_ROWS = 500;

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex",
};

function exactPreviewCommitSha(env: NodeJS.ProcessEnv) {
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

function unavailable(status = 404, errorCode?: string) {
  return NextResponse.json(
    {
      service: "iburo127",
      operation: "staging-maintenance-backlog-classifier",
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
    request.headers.get(CONFIRM_HEADER) !==
      `CLASSIFY_STAGING_MAINTENANCE_BACKLOG:${commitSha}`
  ) {
    return unavailable();
  }

  try {
    const maintenance = readMaintenanceRuntimeConfig({
      ...env,
      IB_MAINTENANCE_SECRET: CONFIG_ONLY_SECRET,
    });
    const deletion = readStoredFileDeletionHealthConfig(env);
    const now = new Date();
    const staleBefore = new Date(
      now.getTime() -
        (maintenance.staleUploadMaxAgeMinutes + maintenance.staleUploadHealthGraceMinutes) *
          60_000,
    );
    const deletionBefore = new Date(now.getTime() - deletion.graceMinutes * 60_000);
    const prisma = getPrismaClient();

    const [staleRows, deletionRows] = await Promise.all([
      prisma.storedFile.findMany({
        where: {
          status: "PENDING_UPLOAD",
          createdAt: { lte: staleBefore },
        },
        select: {
          storageProvider: true,
          fileName: true,
          mimeType: true,
          checksumSha256: true,
          clientCase: { select: { caseNumber: true } },
          uploadedBy: { select: { email: true } },
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: MAX_ROWS + 1,
      }),
      prisma.storedFileDeletion.findMany({
        where: {
          status: "PENDING",
          nextAttemptAt: { lte: deletionBefore },
        },
        select: {
          clientCaseId: true,
          requestedByUserId: true,
          storageProvider: true,
          originalFileStatus: true,
          attemptCount: true,
          leaseUntil: true,
          lastErrorCode: true,
          storageConfirmedAt: true,
        },
        orderBy: [{ nextAttemptAt: "asc" }, { createdAt: "asc" }],
        take: MAX_ROWS + 1,
      }),
    ]);

    if (staleRows.length > MAX_ROWS || deletionRows.length > MAX_ROWS) {
      return unavailable(409, "BACKLOG_CLASSIFIER_LIMIT_EXCEEDED");
    }

    const caseIds = [...new Set(deletionRows.map((row) => row.clientCaseId))];
    const userIds = [...new Set(deletionRows.map((row) => row.requestedByUserId))];
    const [cases, users] = await Promise.all([
      caseIds.length
        ? prisma.clientCase.findMany({
            where: { id: { in: caseIds } },
            select: { id: true, caseNumber: true },
          })
        : [],
      userIds.length
        ? prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, email: true },
          })
        : [],
    ]);
    const caseNumberById = new Map(cases.map((row) => [row.id, row.caseNumber]));
    const emailById = new Map(users.map((row) => [row.id, row.email]));

    const staleTechnical = staleRows.filter(
      (row) =>
        row.clientCase.caseNumber === TECHNICAL_E2E_MUTATION_CASE_NUMBER &&
        row.uploadedBy?.email === TECHNICAL_E2E_CLIENT.email &&
        TECHNICAL_FILE_NAMES.has(row.fileName) &&
        row.mimeType === EXPECTED_MIME &&
        row.storageProvider === EXPECTED_PROVIDER,
    ).length;

    const deletionTechnical = deletionRows.filter(
      (row) =>
        caseNumberById.get(row.clientCaseId) === TECHNICAL_E2E_MUTATION_CASE_NUMBER &&
        emailById.get(row.requestedByUserId) === TECHNICAL_E2E_CLIENT.email &&
        row.storageProvider === EXPECTED_PROVIDER &&
        row.originalFileStatus === "PENDING_SCAN",
    ).length;

    const body = {
      service: "iburo127",
      operation: "staging-maintenance-backlog-classifier",
      environment: "preview",
      branch: VERCEL_STAGING_BRANCH,
      commitSha,
      runtimeTarget: "staging",
      readOnly: true,
      aggregateOnly: true,
      valuesPrinted: false,
      staleUploads: {
        overdue: staleRows.length,
        strictKnownTechnicalFixtures: staleTechnical,
        unknownOrNonTechnical: staleRows.length - staleTechnical,
        expectedProvider: staleRows.filter((row) => row.storageProvider === EXPECTED_PROVIDER).length,
        technicalFileName: staleRows.filter((row) => TECHNICAL_FILE_NAMES.has(row.fileName)).length,
        expectedMime: staleRows.filter((row) => row.mimeType === EXPECTED_MIME).length,
        checksumPresent: staleRows.filter((row) => row.checksumSha256 !== null).length,
      },
      fileDeletion: {
        overduePending: deletionRows.length,
        strictKnownTechnicalFixtures: deletionTechnical,
        unknownOrNonTechnical: deletionRows.length - deletionTechnical,
        expectedProvider: deletionRows.filter((row) => row.storageProvider === EXPECTED_PROVIDER).length,
        originalPendingScan: deletionRows.filter((row) => row.originalFileStatus === "PENDING_SCAN").length,
        zeroAttempts: deletionRows.filter((row) => row.attemptCount === 0).length,
        attempted: deletionRows.filter((row) => row.attemptCount > 0).length,
        leasePresent: deletionRows.filter((row) => row.leaseUntil !== null).length,
        storageConfirmed: deletionRows.filter((row) => row.storageConfirmedAt !== null).length,
        errorCodePresent: deletionRows.filter((row) => row.lastErrorCode !== null).length,
      },
    };

    return NextResponse.json(body, { status: 200, headers: NO_STORE_HEADERS });
  } catch {
    return unavailable(502, "STAGING_MAINTENANCE_BACKLOG_CLASSIFIER_FAILED");
  }
}
