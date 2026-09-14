import { createHash } from "node:crypto";

import { NextResponse } from "next/server";

import { AI_PROVIDER_ERROR, YandexGptGateway } from "@/server/ai/yandex-gpt-core";
import {
  assertStagingYandexAiTarget,
  STAGING_YANDEX_AI_TARGET_GUARD,
} from "@/scripts/staging-yandex-ai-target-guard";
import {
  VERCEL_STAGING_BRANCH,
  isVercelPreviewBackendAllowed,
} from "@/server/config/vercel-preview-boundary";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const EXACT_GIT_SHA_PATTERN = /^[a-f0-9]{40}$/i;
const CONFIRM_HEADER = "x-iburo-staging-ai-confirm";
const CONFIRM_VALUE = "RUN_STAGING_AI_VERIFY";
const EXPECTED_MARKER = "IB_AI_STAGING_OK";
const STAGING_SAFETY_IDENTIFIER = createHash("sha256")
  .update("iburo-staging-yandex-ai-connectivity-check", "utf8")
  .digest("hex");

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

function readTimeoutMs(env: NodeJS.ProcessEnv): number {
  const raw = env.IB_AI_YANDEX_REQUEST_TIMEOUT_MS?.trim();
  if (!raw) return 20_000;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1_000 || value > 60_000) {
    throw new Error(`${STAGING_YANDEX_AI_TARGET_GUARD}:INVALID_REQUEST_TIMEOUT`);
  }
  return value;
}

function safeErrorCode(error: unknown): string {
  if (!(error instanceof Error)) return "STAGING_AI_VERIFY_FAILED";
  if (
    error.message.startsWith(`${AI_PROVIDER_ERROR}:`) ||
    error.message.startsWith(`${STAGING_YANDEX_AI_TARGET_GUARD}:`)
  ) {
    return error.message;
  }
  return "STAGING_AI_VERIFY_FAILED";
}

export async function POST(request: Request) {
  const env = process.env;
  if (!isExactStagingPreview(env) || request.headers.get(CONFIRM_HEADER) !== CONFIRM_VALUE) {
    return NextResponse.json(
      { service: "iburo127", operation: "staging-ai-verify", available: false },
      { status: 404, headers: NO_STORE_HEADERS },
    );
  }

  try {
    const target = assertStagingYandexAiTarget(env);
    const gateway = new YandexGptGateway({
      apiKey: target.apiKey,
      folderId: target.folderId,
      model: target.model,
      endpoint: "https://ai.api.cloud.yandex.net/foundationModels/v1/completion",
      requestTimeoutMs: readTimeoutMs(env),
      maxOutputTokens: 256,
      temperature: 0,
    });

    const response = await gateway.reply({
      instructions: [
        "This is an automated staging-only connectivity check for iBuro.",
        `Reply with exactly this marker and nothing else: ${EXPECTED_MARKER}`,
        "Do not request or output any personal, legal-case, authentication, or secret data.",
      ].join("\n"),
      messages: [{ role: "user", content: "Run the staging connectivity check." }],
      safetyIdentifier: STAGING_SAFETY_IDENTIFIER,
    });

    if (response.trim() !== EXPECTED_MARKER) {
      return NextResponse.json(
        {
          service: "iburo127",
          operation: "staging-ai-verify",
          provider: "yandex",
          verified: false,
          errorCode: "UNEXPECTED_MODEL_OUTPUT",
          networkAccessed: true,
          valuesPrinted: false,
          clientCaseDataIncluded: false,
          providerResponseLogged: false,
        },
        { status: 502, headers: NO_STORE_HEADERS },
      );
    }

    return NextResponse.json(
      {
        service: "iburo127",
        operation: "staging-ai-verify",
        environment: "preview",
        branch: VERCEL_STAGING_BRANCH,
        commitSha: exactPreviewCommitSha(env),
        runtimeTarget: "staging",
        provider: "yandex",
        verified: true,
        markerMatched: true,
        networkAccessed: true,
        valuesPrinted: false,
        clientCaseDataIncluded: false,
        providerResponseLogged: false,
        providerRequestDataLogging: "disabled",
      },
      { headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    return NextResponse.json(
      {
        service: "iburo127",
        operation: "staging-ai-verify",
        provider: "yandex",
        verified: false,
        errorCode: safeErrorCode(error),
        networkAccessed: true,
        valuesPrinted: false,
        clientCaseDataIncluded: false,
        providerResponseLogged: false,
      },
      { status: 502, headers: NO_STORE_HEADERS },
    );
  }
}
