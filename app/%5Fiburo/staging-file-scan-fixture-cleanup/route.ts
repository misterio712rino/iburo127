import { NextResponse } from "next/server";

import { getPrismaClient } from "@/server/database/prisma";
import { getPrivateObjectStorage } from "@/server/files/object-storage-runtime";
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
const CONFIRM_HEADER = "x-iburo-staging-file-scan-cleanup-confirm";
const CONFIRM_PREFIX = "CLEAN_STAGING_FILE_SCAN_FIXTURES:";
const FIXTURE_NAMES = ["iburo-staging-e2e.pdf", "iburo-staging-file-lifecycle.pdf"] as const;
const FIXTURE_MIME_TYPE = "application/pdf";
const MIN_AGE_MINUTES = 30;
const MAX_FIXTURES = 100;

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

function boundaryFailureCode(env: NodeJS.ProcessEnv, request: Request, commitSha: string | null) {
  if (env.VERCEL_ENV?.trim() !== "preview") return "PREVIEW_ENV_MISMATCH";
  if (env.VERCEL_GIT_COMMIT_REF?.trim() !== VERCEL_STAGING_BRANCH) return "PREVIEW_BRANCH_MISMATCH";
  if (env.IB_RUNTIME_TARGET?.trim() !== "staging") return "RUNTIME_TARGET_MISMATCH";
  if (!commitSha) return "PREVIEW_COMMIT_MISSING";
  if (!isVercelPreviewBackendAllowed(env)) return "PREVIEW_BACKEND_DISABLED";
  if (request.headers.get(CONFIRM_HEADER) !== `${CONFIRM_PREFIX}${commitSha}`) {
    return "CONFIRMATION_MISMATCH";
  }
  return null;
}

function confirmationDiagnostic(request: Request, commitSha: string | null) {
  const received = request.headers.get(CONFIRM_HEADER);
  const expected = commitSha ? `${CONFIRM_PREFIX}${commitSha}` : null;
  return {
    confirmationPresent: received !== null,
    confirmationLength: received?.length ?? 0,
    confirmationExpectedLength: expected?.length ?? 0,
    confirmationPrefixMatch: received?.startsWith(CONFIRM_PREFIX) ?? false,
    confirmationSuffixIsCommit: Boolean(commitSha && received?.endsWith(commitSha)),
    confirmationMatchesIgnoreCase: Boolean(
      expected && received && received.toLowerCase() === expected.toLowerCase(),
    ),
  };
}

function unavailable(
  status = 404,
  errorCode?: string,
  diagnostic?: ReturnType<typeof confirmationDiagnostic>,
) {
  return NextResponse.json(
    {
      service: "iburo127",
      operation: "staging-file-scan-fixture-cleanup",
      pass: false,
      ...(errorCode ? { errorCode } : {}),
      ...(diagnostic ? { diagnostic } : {}),
    },
    { status, headers: NO_STORE_HEADERS },
  );
}

export async function POST(request: Request) {
  const env = process.env;
  const commitSha = exactPreviewCommitSha(env);
  const boundaryError = boundaryFailureCode(env, request, commitSha);
  if (!isExactStagingPreview(env) || !commitSha || boundaryError) {
    return unavailable(
      404,
      boundaryError ?? "STAGING_BOUNDARY_MISMATCH",
      boundaryError === "CONFIRMATION_MISMATCH"
        ? confirmationDiagnostic(request, commitSha)
        : undefined,
    );
  }

  const prisma = getPrismaClient();
  const storage = getPrivateObjectStorage();
  const cutoff = new Date(Date.now() - MIN_AGE_MINUTES * 60_000);

  try {
    const [client, clientCase] = await Promise.all([
      prisma.user.findUnique({
        where: { email: TECHNICAL_E2E_CLIENT.email },
        select: { id: true },
      }),
      prisma.clientCase.findUnique({
        where: { caseNumber: TECHNICAL_E2E_MUTATION_CASE_NUMBER },
        select: { id: true, clientId: true },
      }),
    ]);

    if (!client || !clientCase || clientCase.clientId !== client.id) {
      return unavailable(409, "TECHNICAL_FIXTURE_IDENTITY_MISMATCH");
    }

    const files = await prisma.storedFile.findMany({
      where: {
        clientCaseId: clientCase.id,
        uploadedById: client.id,
        status: "PENDING_SCAN",
        fileName: { in: [...FIXTURE_NAMES] },
        mimeType: FIXTURE_MIME_TYPE,
        createdAt: { lte: cutoff },
        scanNextAttemptAt: { lte: cutoff },
      },
      select: {
        id: true,
        storageProvider: true,
        objectKey: true,
        fileName: true,
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: MAX_FIXTURES + 1,
    });

    if (files.length > MAX_FIXTURES) {
      return unavailable(409, "TECHNICAL_FIXTURE_LIMIT_EXCEEDED");
    }

    const objectKeyPrefix = `cases/${clientCase.id}/`;
    let deleted = 0;

    for (const file of files) {
      if (
        file.storageProvider !== storage.providerCode ||
        !file.objectKey.startsWith(objectKeyPrefix) ||
        !FIXTURE_NAMES.includes(file.fileName as (typeof FIXTURE_NAMES)[number])
      ) {
        return unavailable(409, "TECHNICAL_FIXTURE_STORAGE_MISMATCH");
      }

      if (await storage.statObject(file.objectKey)) {
        await storage.deleteObject(file.objectKey);
      }

      const removed = await prisma.storedFile.deleteMany({
        where: {
          id: file.id,
          clientCaseId: clientCase.id,
          uploadedById: client.id,
          status: "PENDING_SCAN",
          fileName: file.fileName,
          mimeType: FIXTURE_MIME_TYPE,
          objectKey: file.objectKey,
          createdAt: { lte: cutoff },
          scanNextAttemptAt: { lte: cutoff },
        },
      });
      if (removed.count !== 1) {
        return unavailable(409, "TECHNICAL_FIXTURE_DELETE_CONFLICT");
      }
      deleted += 1;
    }

    return NextResponse.json(
      {
        service: "iburo127",
        operation: "staging-file-scan-fixture-cleanup",
        environment: "preview",
        branch: VERCEL_STAGING_BRANCH,
        commitSha,
        runtimeTarget: "staging",
        pass: true,
        deleted,
        maxFixtures: MAX_FIXTURES,
        minimumAgeMinutes: MIN_AGE_MINUTES,
        aggregateOnly: true,
        valuesPrinted: false,
      },
      { status: 200, headers: NO_STORE_HEADERS },
    );
  } catch {
    return unavailable(502, "STAGING_FILE_SCAN_FIXTURE_CLEANUP_FAILED");
  }
}
