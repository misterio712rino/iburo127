import { NextResponse } from "next/server";

import { buildProviderAwareStagingAiReadiness } from "@/scripts/staging-ai-readiness";
import { buildStagingEnvironmentInventory } from "@/scripts/staging-environment-inventory";
import { buildProviderAwareStagingStorageReadiness } from "@/scripts/staging-storage-readiness";
import {
  VERCEL_STAGING_BRANCH,
  isVercelPreviewBackendAllowed,
} from "@/server/config/vercel-preview-boundary";
import { readStoredFileDeletionMode } from "@/server/files/deletion-mode";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const EXACT_GIT_SHA_PATTERN = /^[a-f0-9]{40}$/i;

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

export async function GET() {
  const env = process.env;
  if (!isExactStagingPreview(env)) {
    return NextResponse.json(
      { service: "iburo127", operation: "staging-external-readiness", available: false },
      { status: 404, headers: NO_STORE_HEADERS },
    );
  }

  const inventory = buildStagingEnvironmentInventory(env);
  const providerAwareStorage = buildProviderAwareStagingStorageReadiness(env);
  const providerAwareAi = buildProviderAwareStagingAiReadiness(env);

  let fileDeletionMode: "legacy" | "durable" | "invalid";
  try {
    fileDeletionMode = readStoredFileDeletionMode(env);
  } catch {
    fileDeletionMode = "invalid";
  }

  return NextResponse.json(
    {
      service: "iburo127",
      operation: "staging-external-readiness",
      environment: "preview",
      branch: VERCEL_STAGING_BRANCH,
      commitSha: exactPreviewCommitSha(env),
      runtimeTarget: "staging",
      networkAccessed: inventory.networkAccessed,
      valuesPrinted: inventory.valuesPrinted,
      phases: {
        storage: providerAwareStorage.storage,
        scanner: providerAwareStorage.scanner,
        ai: providerAwareAi,
        postbox: inventory.phases.postbox,
        bitrix24: inventory.phases.bitrix24,
        maintenance: inventory.phases.maintenance,
        fileDeletion: {
          mode: fileDeletionMode,
          ready: fileDeletionMode === "durable" && inventory.phases.maintenance.ready,
        },
      },
    },
    { headers: NO_STORE_HEADERS },
  );
}
