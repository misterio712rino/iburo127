import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

import { readBoundedScannerJson } from "@/scripts/staging-scanner-bounded-json";
import { readFileScannerRuntimeConfig } from "@/server/config/production";
import {
  VERCEL_STAGING_BRANCH,
  isVercelPreviewBackendAllowed,
} from "@/server/config/vercel-preview-boundary";
import { scanWithHttpMalwareScanner } from "@/server/files/http-malware-scanner-core";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const preferredRegion = "fra1";

const EXPECTED_SCANNER_ORIGIN = "https://scanner-v2-staging.iburo127.online";
const CONTROL_HEADER = "x-iburo-staging-scanner-control";
const FINGERPRINT_HEADER = "x-iburo-staging-scanner-secret-sha256";
const MAX_REQUEST_BYTES = 8 * 1024;
const MAX_HEALTH_BYTES = 128;
const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex",
};
type BridgeRequest =
  | { operation: "health" }
  | {
      operation: "scan";
      sourceUrl: string;
      mimeType: "application/octet-stream";
      sizeBytes: string;
    };

function exactPreviewCommitSha(env: NodeJS.ProcessEnv): string | null {
  const value = env.VERCEL_GIT_COMMIT_SHA?.trim().toLowerCase();
  return value && /^[a-f0-9]{40}$/.test(value) ? value : null;
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

type ScannerBridgeDiagnostic =
  | "CONFIG"
  | "ORIGIN"
  | "FINGERPRINT"
  | "CONTROL"
  | "REQUEST"
  | "UPSTREAM"
  | "UPSTREAM_NETWORK"
  | "UPSTREAM_HTTP"
  | "UPSTREAM_FORMAT"
  | "UPSTREAM_BODY";
const DIAGNOSTIC_HEADER = "X-Iburo-Staging-Scanner-Bridge-Diagnostic";
function unavailable(status = 404, reason?: ScannerBridgeDiagnostic) {
  return NextResponse.json(
    { available: false },
    {
      status,
      headers: reason
        ? { ...NO_STORE_HEADERS, [DIAGNOSTIC_HEADER]: reason }
        : NO_STORE_HEADERS,
    },
  );
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left, "utf8");
  const b = Buffer.from(right, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}
async function readBoundedRequest(request: Request): Promise<BridgeRequest> {
  const mediaType = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  const reported = request.headers.get("content-length");
  if (
    mediaType !== "application/json" ||
    (reported !== null && (!/^\d+$/.test(reported) || Number(reported) > MAX_REQUEST_BYTES)) ||
    !request.body
  ) throw new Error("REQUEST_DENIED");

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > MAX_REQUEST_BYTES) throw new Error("REQUEST_DENIED");
      chunks.push(value);
    }
  } finally {
    if (total > MAX_REQUEST_BYTES) await reader.cancel().catch(() => {});
    reader.releaseLock();
  }

  const parsed: unknown = JSON.parse(
    new TextDecoder("utf-8", { fatal: true }).decode(
      Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))),
    ),
  );
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("REQUEST_DENIED");
  }
  const input = parsed as Record<string, unknown>;
  if (input.operation === "health" && Object.keys(input).length === 1) {
    return { operation: "health" };
  }
  if (
    input.operation !== "scan" ||
    Object.keys(input).length !== 4 ||
    typeof input.sourceUrl !== "string" ||
    input.sourceUrl.length < 1 ||
    input.sourceUrl.length > 6144 ||
    input.mimeType !== "application/octet-stream" ||
    typeof input.sizeBytes !== "string" ||
    !/^[1-9]\d{0,3}$/.test(input.sizeBytes)
  ) throw new Error("REQUEST_DENIED");

  const sizeBytes = BigInt(input.sizeBytes);
  if (sizeBytes > BigInt(1024)) throw new Error("REQUEST_DENIED");
  return {
    operation: "scan",
    sourceUrl: input.sourceUrl,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
  };
}

class ScannerBridgeUpstreamError extends Error {
  constructor(readonly reason: ScannerBridgeDiagnostic) {
    super(reason);
    this.name = "ScannerBridgeUpstreamError";
  }
}

async function verifyScannerHealth(config: ReturnType<typeof readFileScannerRuntimeConfig>) {
  let response: Response;
  try {
    response = await fetch(`${config.origin}/health`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${config.secret}`,
        Accept: "application/json",
        "Cache-Control": "no-store",
      },
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(Math.min(config.requestTimeoutMs, 15_000)),
    });
  } catch {
    throw new ScannerBridgeUpstreamError("UPSTREAM_NETWORK");
  }

  if (response.status !== 200) {
    await response.body?.cancel().catch(() => {});
    throw new ScannerBridgeUpstreamError("UPSTREAM_HTTP");
  }
  if (
    response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json"
  ) {
    await response.body?.cancel().catch(() => {});
    throw new ScannerBridgeUpstreamError("UPSTREAM_FORMAT");
  }

  let parsed: unknown;
  try {
    parsed = await readBoundedScannerJson(response, MAX_HEALTH_BYTES);
  } catch {
    throw new ScannerBridgeUpstreamError("UPSTREAM_BODY");
  }
  if (
    !parsed ||
    typeof parsed !== "object" ||
    Array.isArray(parsed) ||
    Object.keys(parsed).length !== 1 ||
    (parsed as { status?: unknown }).status !== "ok"
  ) throw new ScannerBridgeUpstreamError("UPSTREAM_BODY");
}

export async function POST(request: Request) {
  const env = process.env;
  if (!isExactStagingPreview(env)) return unavailable();

  const commitSha = exactPreviewCommitSha(env);
  const fingerprint = request.headers.get(FINGERPRINT_HEADER)?.trim().toLowerCase() ?? "";
  if (!commitSha || !/^[a-f0-9]{64}$/.test(fingerprint)) return unavailable(404, "REQUEST");

  let config: ReturnType<typeof readFileScannerRuntimeConfig>;
  try {
    config = readFileScannerRuntimeConfig(env);
  } catch {
    return unavailable(404, "CONFIG");
  }
  if (config.origin !== EXPECTED_SCANNER_ORIGIN) return unavailable(404, "ORIGIN");
  const actualFingerprint = createHash("sha256").update(config.secret, "utf8").digest("hex");
  if (!safeEqual(actualFingerprint, fingerprint)) return unavailable(404, "FINGERPRINT");

  const expectedControl = `RUN_STAGING_SCANNER_BRIDGE:${commitSha}:${fingerprint}`;
  const suppliedControl = request.headers.get(CONTROL_HEADER) ?? "";
  if (!safeEqual(suppliedControl, expectedControl)) return unavailable(404, "CONTROL");

  let input: BridgeRequest;
  try {
    input = await readBoundedRequest(request);
  } catch {
    return unavailable(404, "REQUEST");
  }

  try {
    if (input.operation === "health") {
      await verifyScannerHealth(config);
      return NextResponse.json(
        { operation: "health", status: "ok" },
        { status: 200, headers: NO_STORE_HEADERS },
      );
    }

    const result = await scanWithHttpMalwareScanner(config, {
      sourceUrl: input.sourceUrl,
      mimeType: input.mimeType,
      sizeBytes: BigInt(input.sizeBytes),
    });
    return NextResponse.json(
      { operation: "scan", verdict: result.verdict },
      { status: 200, headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    if (error instanceof ScannerBridgeUpstreamError) {
      return unavailable(502, error.reason);
    }
    return unavailable(502, "UPSTREAM");
  }
}
