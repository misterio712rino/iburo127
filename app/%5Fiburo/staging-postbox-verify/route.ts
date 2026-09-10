import { NextResponse } from "next/server";

import {
  PRODUCTION_CONFIG_ERROR,
  readYandexPostboxConfig,
} from "@/server/config/production";
import {
  EMAIL_DELIVERY_FAILED,
  sendYandexPostboxEmail,
} from "@/server/email/yandex-postbox-core";
import {
  assertStagingPostboxTarget,
  STAGING_POSTBOX_SIMULATOR_RECIPIENT,
  STAGING_POSTBOX_TARGET_GUARD,
} from "@/scripts/staging-postbox-target-guard";
import {
  VERCEL_STAGING_BRANCH,
  isVercelPreviewBackendAllowed,
} from "@/server/config/vercel-preview-boundary";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const EXACT_GIT_SHA_PATTERN = /^[a-f0-9]{40}$/i;
const CONFIRM_HEADER = "x-iburo-staging-postbox-confirm";
const CONFIRM_VALUE = "RUN_STAGING_POSTBOX_VERIFY";

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

function safeErrorCode(error: unknown): string {
  if (!(error instanceof Error)) return "STAGING_POSTBOX_VERIFY_FAILED";
  if (error.message.startsWith(`${EMAIL_DELIVERY_FAILED}:`)) return error.message;
  if (error.message.startsWith(`${STAGING_POSTBOX_TARGET_GUARD}:`)) {
    return "STAGING_POSTBOX_TARGET_INVALID";
  }
  if (error.message.startsWith(`${PRODUCTION_CONFIG_ERROR}:`)) {
    return "STAGING_POSTBOX_CONFIG_INVALID";
  }
  return "STAGING_POSTBOX_VERIFY_FAILED";
}

export async function POST(request: Request) {
  const env = process.env;
  if (!isExactStagingPreview(env) || request.headers.get(CONFIRM_HEADER) !== CONFIRM_VALUE) {
    return NextResponse.json(
      { service: "iburo127", operation: "staging-postbox-verify", available: false },
      { status: 404, headers: NO_STORE_HEADERS },
    );
  }

  let networkAccessed = false;
  try {
    const target = assertStagingPostboxTarget(env);
    const config = readYandexPostboxConfig(env);
    if (config.fromEmail !== target.fromEmail || config.accessKeyId !== target.accessKeyId) {
      throw new Error(`${STAGING_POSTBOX_TARGET_GUARD}:CONFIG_MISMATCH`);
    }

    networkAccessed = true;
    await sendYandexPostboxEmail(config, {
      to: STAGING_POSTBOX_SIMULATOR_RECIPIENT,
      subject: "iBuro staging Postbox connectivity check",
      text: "Automated staging-only delivery verification. No client or case data is included.",
    });

    return NextResponse.json(
      {
        service: "iburo127",
        operation: "staging-postbox-verify",
        environment: "preview",
        branch: VERCEL_STAGING_BRANCH,
        commitSha: exactPreviewCommitSha(env),
        runtimeTarget: "staging",
        provider: "yandex-postbox",
        verified: true,
        simulatorOnly: true,
        recipient: STAGING_POSTBOX_SIMULATOR_RECIPIENT,
        networkAccessed: true,
        valuesPrinted: false,
        clientCaseDataIncluded: false,
        providerResponseLogged: false,
      },
      { headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    return NextResponse.json(
      {
        service: "iburo127",
        operation: "staging-postbox-verify",
        provider: "yandex-postbox",
        verified: false,
        simulatorOnly: true,
        errorCode: safeErrorCode(error),
        networkAccessed,
        valuesPrinted: false,
        clientCaseDataIncluded: false,
        providerResponseLogged: false,
      },
      { status: networkAccessed ? 502 : 503, headers: NO_STORE_HEADERS },
    );
  }
}
