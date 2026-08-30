import { NextResponse } from "next/server";
import {
  VERCEL_STAGING_BRANCH,
  isVercelPreviewBackendAllowed,
} from "@/server/config/vercel-preview-boundary";

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

export async function GET() {
  const env = process.env;
  return NextResponse.json(
    {
      service: "iburo127",
      environment: runtimeEnvironment(env),
      branch: env.VERCEL_GIT_COMMIT_REF?.trim() === VERCEL_STAGING_BRANCH ? VERCEL_STAGING_BRANCH : "other",
      commitSha: commitSha(env),
      runtimeTarget: runtimeTarget(env),
      backendEnabled: isVercelPreviewBackendAllowed(env),
    },
    { headers: NO_STORE_HEADERS },
  );
}
