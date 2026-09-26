import { NextResponse } from "next/server";

import { readMaintenanceRuntimeConfig } from "@/server/config/production";
import {
  VERCEL_STAGING_BRANCH,
  isVercelPreviewBackendAllowed,
} from "@/server/config/vercel-preview-boundary";
import { getPrismaClient } from "@/server/database/prisma";
import { readStoredFileDeletionHealthConfig } from "@/server/files/deletion-health-config";
import {
  TECHNICAL_E2E_CLIENT,
  TECHNICAL_E2E_MUTATION_CASE_NUMBER,
} from "@/server/staging/technical-e2e-fixture";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const EXACT_GIT_SHA_PATTERN = /^[a-f0-9]{40}$/i;
const CONFIG_ONLY_SECRET = "x".repeat(32);
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

export async function GET() {
  const env = process.env;
  const commitSha = exactPreviewCommitSha(env);
  if (!isExactStagingPreview(env) || !commitSha) return unavailable();

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

        const staleBase = {
          status: "PENDING_UPLOAD" as const,
          createdAt: { lte: staleBefore },
        };
        const deletionBase = {
          status: "PENDING" as const,
          nextAttemptAt: { lte: deletionBefore },
        };

        const [staleTotal, deletionTotal] = await Promise.all([
          tx.storedFile.count({ where: staleBase }),
          tx.storedFileDeletion.count({ where: deletionBase }),
        ]);

        if (!technicalIdentityValid || !technicalClient || !technicalCase) {
          return {
            technicalIdentityValid: false,
            staleTotal,
            staleIdentityTechnical: 0,
            staleStrictTechnical: 0,
            deletionTotal,
            deletionIdentityTechnical: 0,
            deletionStrictTechnical: 0,
          };
        }

        const [
          staleIdentityTechnical,
          staleStrictTechnical,
          deletionIdentityTechnical,
          deletionStrictTechnical,
        ] = await Promise.all([
          tx.storedFile.count({
            where: {
              ...staleBase,
              clientCaseId: technicalCase.id,
              uploadedById: technicalClient.id,
            },
          }),
          tx.storedFile.count({
            where: {
              ...staleBase,
              clientCaseId: technicalCase.id,
              uploadedById: technicalClient.id,
              fileName: { in: [...KNOWN_FIXTURE_NAMES] },
              mimeType: FIXTURE_MIME_TYPE,
              storageProvider: EXPECTED_STORAGE_PROVIDER,
              objectKey: { startsWith: `cases/${technicalCase.id}/` },
            },
          }),
          tx.storedFileDeletion.count({
            where: {
              ...deletionBase,
              clientCaseId: technicalCase.id,
              requestedByUserId: technicalClient.id,
            },
          }),
          tx.storedFileDeletion.count({
            where: {
              ...deletionBase,
              clientCaseId: technicalCase.id,
              requestedByUserId: technicalClient.id,
              storageProvider: EXPECTED_STORAGE_PROVIDER,
              originalFileStatus: "PENDING_SCAN",
              attemptCount: 0,
              leaseUntil: null,
              storageConfirmedAt: null,
              lastErrorCode: null,
            },
          }),
        ]);

        return {
          technicalIdentityValid,
          staleTotal,
          staleIdentityTechnical,
          staleStrictTechnical,
          deletionTotal,
          deletionIdentityTechnical,
          deletionStrictTechnical,
        };
      },
      { isolationLevel: "RepeatableRead" },
    );

    return NextResponse.json(
      {
        service: "iburo127",
        operation: "staging-maintenance-backlog-classifier",
        environment: "preview",
        branch: VERCEL_STAGING_BRANCH,
        commitSha,
        runtimeTarget: "staging",
        pass: true,
        readOnly: true,
        aggregateOnly: true,
        valuesPrinted: false,
        snapshotIsolation: "REPEATABLE_READ",
        provenance: {
          technicalIdentityValid: aggregate.technicalIdentityValid,
        },
        staleUploads: {
          overdue: aggregate.staleTotal,
          identityTechnical: aggregate.staleIdentityTechnical,
          strictKnownTechnicalFixtures: aggregate.staleStrictTechnical,
          unknownOrNonTechnical: Math.max(
            0,
            aggregate.staleTotal - aggregate.staleStrictTechnical,
          ),
        },
        fileDeletion: {
          overduePending: aggregate.deletionTotal,
          identityTechnical: aggregate.deletionIdentityTechnical,
          strictKnownTechnicalFixtures: aggregate.deletionStrictTechnical,
          unknownOrNonTechnical: Math.max(
            0,
            aggregate.deletionTotal - aggregate.deletionStrictTechnical,
          ),
        },
      },
      { status: 200, headers: NO_STORE_HEADERS },
    );
  } catch {
    return unavailable(502, "STAGING_MAINTENANCE_BACKLOG_CLASSIFIER_FAILED");
  }
}
