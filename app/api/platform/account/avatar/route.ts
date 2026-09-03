import { privateJsonResponse, privateResponse } from "@/server/http/private-json";
import {
  ACCOUNT_AVATAR_INVALID_INPUT,
  ACCOUNT_AVATAR_NOT_FOUND,
  completeCurrentAccountAvatarUpload,
  createCurrentAccountAvatarDownload,
  createCurrentAccountAvatarUpload,
} from "@/server/account/avatar";
import { createProductionSessionProvider } from "@/server/auth/production-session-provider";
import { UNAUTHENTICATED } from "@/server/auth/runtime";

const AVATAR_FETCH_TIMEOUT_MS = 15_000;
const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

async function readBoundedBinaryBody(request: Request) {
  if (!request.body) throw new Error(ACCOUNT_AVATAR_INVALID_INPUT);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value?.byteLength) continue;
    total += value.byteLength;
    if (total > MAX_AVATAR_SIZE_BYTES) {
      await reader.cancel();
      throw new Error(ACCOUNT_AVATAR_INVALID_INPUT);
    }
    chunks.push(value);
  }

  if (total <= 0) throw new Error(ACCOUNT_AVATAR_INVALID_INPUT);
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export async function GET() {
  try {
    const avatar = await createCurrentAccountAvatarDownload();
    const upstream = await fetch(avatar.url, {
      cache: "no-store",
      signal: AbortSignal.timeout(AVATAR_FETCH_TIMEOUT_MS),
    });
    if (!upstream.ok || !upstream.body) {
      return privateResponse(null, { status: 404 });
    }

    const contentType = upstream.headers.get("content-type")?.trim().toLowerCase() || avatar.mimeType;
    if (!ALLOWED_AVATAR_TYPES.has(contentType)) {
      return privateResponse(null, { status: 415 });
    }

    return privateResponse(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": "inline",
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === UNAUTHENTICATED) {
      return privateResponse(null, { status: 401 });
    }
    if (error instanceof Error && error.message === ACCOUNT_AVATAR_NOT_FOUND) {
      return privateResponse(null, { status: 404 });
    }
    throw error;
  }
}

export async function POST(request: Request) {
  const mimeType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() ?? "";
  if (!ALLOWED_AVATAR_TYPES.has(mimeType)) {
    return privateJsonResponse({ code: ACCOUNT_AVATAR_INVALID_INPUT }, 400);
  }

  try {
    const body = await readBoundedBinaryBody(request);
    const sessionProvider = createProductionSessionProvider();
    const ticket = await createCurrentAccountAvatarUpload(sessionProvider, {
      mimeType,
      sizeBytes: body.byteLength,
    });

    const upload = await fetch(ticket.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": mimeType },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(AVATAR_FETCH_TIMEOUT_MS),
    });
    if (!upload.ok) {
      return privateJsonResponse({ code: "ACCOUNT_AVATAR_UPLOAD_FAILED" }, 502);
    }

    await completeCurrentAccountAvatarUpload(sessionProvider, ticket.objectKey);
    return privateJsonResponse({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === UNAUTHENTICATED) {
      return privateJsonResponse({ code: UNAUTHENTICATED }, 401);
    }
    if (error instanceof Error && error.message === ACCOUNT_AVATAR_NOT_FOUND) {
      return privateJsonResponse({ code: ACCOUNT_AVATAR_NOT_FOUND }, 409);
    }
    if (error instanceof Error && error.message === ACCOUNT_AVATAR_INVALID_INPUT) {
      return privateJsonResponse({ code: ACCOUNT_AVATAR_INVALID_INPUT }, 400);
    }
    throw error;
  }
}
