import { NextResponse } from "next/server";
import {
  VERCEL_STAGING_BRANCH,
  isVercelPreviewBackendAllowed,
} from "@/server/config/vercel-preview-boundary";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff",
};

function runtimeEnvironment(env: NodeJS.ProcessEnv) {
  const value = env.VERCEL_ENV?.trim();
  if (value === "preview" || value === "production" || value === "development") return value;
  return "unknown";
}

function runtimeTarget(env: NodeJS.ProcessEnv) {
  const value = env.IB_RUNTIME_TARGET?.trim();
  if (value === "staging" || value === "production") return value;
  return "unknown";
}

function commitSha(env: NodeJS.ProcessEnv) {
  const value = env.VERCEL_GIT_COMMIT_SHA?.trim();
  return value && /^[a-f0-9]{40}$/i.test(value) ? value.toLowerCase() : null;
}

function isExactStagingPreview(env: NodeJS.ProcessEnv) {
  return (
    env.VERCEL_ENV?.trim() === "preview" &&
    env.VERCEL_GIT_COMMIT_REF?.trim() === VERCEL_STAGING_BRANCH &&
    env.IB_RUNTIME_TARGET?.trim() === "staging" &&
    commitSha(env) !== null &&
    isVercelPreviewBackendAllowed(env)
  );
}

export async function GET() {
  const env = process.env;
  if (!isExactStagingPreview(env)) {
    return new NextResponse(null, { status: 404, headers: NO_STORE_HEADERS });
  }

  return NextResponse.json(
    {
      service: "iburo127",
      environment: runtimeEnvironment(env),
      branch: VERCEL_STAGING_BRANCH,
      commitSha: commitSha(env),
      runtimeTarget: runtimeTarget(env),
      backendEnabled: true,
    },
    { headers: NO_STORE_HEADERS },
  );
}
