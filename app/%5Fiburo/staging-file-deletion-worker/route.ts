import { NextResponse } from "next/server";

import {
  VERCEL_STAGING_BRANCH,
  isVercelPreviewBackendAllowed,
} from "@/server/config/vercel-preview-boundary";
import { readStoredFileDeletionMode } from "@/server/files/deletion-mode";
import { getStoredFileDeletionWorker } from "@/server/files/deletion-worker-runtime";
import { PrismaStoredFileDeletionRepository } from "@/server/repositories/prisma/stored-file-deletion-repository";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const EXACT_GIT_SHA_PATTERN = /^[a-f0-9]{40}$/i;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CONFIRM_HEADER = "x-iburo-staging-file-deletion-confirm";
const MAX_CLAIMS_PER_PROOF = 20;

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
      operation: "staging-file-deletion-worker",
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
    request.headers.get(CONFIRM_HEADER) !== `RUN_STAGING_FILE_DELETION:${commitSha}`
  ) {
    return unavailable();
  }

  let fileId: string | null = null;
  try {
    const body = (await request.json()) as { fileId?: unknown };
    if (typeof body.fileId === "string" && UUID_PATTERN.test(body.fileId)) {
      fileId = body.fileId.toLowerCase();
    }
  } catch {
    return unavailable(400, "STAGING_FILE_DELETION_REQUEST_INVALID");
  }
  if (!fileId) return unavailable(400, "STAGING_FILE_DELETION_REQUEST_INVALID");

  try {
    if (readStoredFileDeletionMode(env) !== "durable") {
      return unavailable(409, "STAGING_FILE_DELETION_NOT_DURABLE");
    }

    const repository = new PrismaStoredFileDeletionRepository();
    let target = await repository.getByFileId(fileId);
    if (!target) return unavailable(404, "STAGING_FILE_DELETION_NOT_FOUND");

    const totals = {
      claimed: 0,
      completed: 0,
      retried: 0,
      requiresAttention: 0,
      leaseLost: 0,
      finalizationDeferred: 0,
    };

    for (let index = 0; index < MAX_CLAIMS_PER_PROOF; index += 1) {
      if (target.status === "COMPLETED" || target.status === "REQUIRES_ATTENTION") break;

      const result = await getStoredFileDeletionWorker().runBatch({ now: new Date(), limit: 1 });
      for (const key of Object.keys(totals) as Array<keyof typeof totals>) {
        totals[key] += result[key];
      }
      if (result.claimed === 0) break;
      target = (await repository.getByFileId(fileId)) ?? target;
    }

    target = (await repository.getByFileId(fileId)) ?? target;
    const pass =
      target.status === "COMPLETED" &&
      target.storageConfirmedAt !== null &&
      target.completedAt !== null &&
      target.completionActivityEventId !== null &&
      totals.requiresAttention === 0 &&
      totals.finalizationDeferred === 0;

    return NextResponse.json(
      {
        service: "iburo127",
        operation: "staging-file-deletion-worker",
        environment: "preview",
        branch: VERCEL_STAGING_BRANCH,
        commitSha,
        runtimeTarget: "staging",
        mode: "durable",
        pass,
        targetStatus: target.status,
        storageConfirmed: target.storageConfirmedAt !== null,
        auditEventRecorded: target.completionActivityEventId !== null,
        worker: totals,
        valuesPrinted: false,
      },
      { status: pass ? 200 : target.status === "REQUIRES_ATTENTION" ? 503 : 409, headers: NO_STORE_HEADERS },
    );
  } catch {
    return unavailable(502, "STAGING_FILE_DELETION_WORKER_FAILED");
  }
}
