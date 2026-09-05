import { NextResponse } from "next/server";

import { assertStagingStorageTarget } from "@/scripts/staging-storage-target-guard";
import { verifyVercelBlobStagingAccess } from "@/scripts/staging-vercel-blob-verification";
import { VERCEL_BLOB_STORAGE_PROVIDER } from "@/server/files/object-storage-provider";
import {
  VERCEL_STAGING_BRANCH,
  isVercelPreviewBackendAllowed,
} from "@/server/config/vercel-preview-boundary";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const EXACT_GIT_SHA_PATTERN = /^[a-f0-9]{40}$/i;
const CONFIRM_HEADER = "x-iburo-staging-storage-confirm";
const CONFIRM_VALUE = "RUN_STAGING_STORAGE_VERIFY";

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

export async function POST(request: Request) {
  const env = process.env;
  if (!isExactStagingPreview(env) || request.headers.get(CONFIRM_HEADER) !== CONFIRM_VALUE) {
    return NextResponse.json(
      { service: "iburo127", operation: "staging-storage-verify", available: false },
      { status: 404, headers: NO_STORE_HEADERS },
    );
  }

  try {
    const target = assertStagingStorageTarget(env);
    if (target.provider !== VERCEL_BLOB_STORAGE_PROVIDER) {
      return NextResponse.json(
        {
          service: "iburo127",
          operation: "staging-storage-verify",
          verified: false,
          errorCode: "STAGING_STORAGE_PROVIDER_NOT_VERCEL_BLOB",
        },
        { status: 409, headers: NO_STORE_HEADERS },
      );
    }

    const verification = await verifyVercelBlobStagingAccess(target);
    return NextResponse.json(
      {
        service: "iburo127",
        operation: "staging-storage-verify",
        environment: "preview",
        branch: VERCEL_STAGING_BRANCH,
        commitSha: exactPreviewCommitSha(env),
        runtimeTarget: "staging",
        verified: true,
        ...verification,
      },
      { headers: NO_STORE_HEADERS },
    );
  } catch {
    return NextResponse.json(
      {
        service: "iburo127",
        operation: "staging-storage-verify",
        verified: false,
        errorCode: "STAGING_STORAGE_VERIFY_FAILED",
      },
      { status: 502, headers: NO_STORE_HEADERS },
    );
  }
}
