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
import {
  BINARY_BODY_TOO_LARGE,
  EMPTY_BINARY_BODY,
  readBinaryBodyWithByteLimit,
} from "@/server/http/bounded-binary-body";

const AVATAR_FETCH_TIMEOUT_MS = 15_000;
const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function GET() {
  try {
    const sessionProvider = createProductionSessionProvider();
    const avatar = await createCurrentAccountAvatarDownload(sessionProvider);
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
    const body = await readBinaryBodyWithByteLimit(request, MAX_AVATAR_SIZE_BYTES);
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
    if (
      error instanceof Error &&
      (error.message === ACCOUNT_AVATAR_INVALID_INPUT ||
        error.message === EMPTY_BINARY_BODY ||
        error.message === BINARY_BODY_TOO_LARGE)
    ) {
      return privateJsonResponse({ code: ACCOUNT_AVATAR_INVALID_INPUT }, 400);
    }
    if (error instanceof Error && error.message === ACCOUNT_AVATAR_NOT_FOUND) {
      return privateJsonResponse({ code: ACCOUNT_AVATAR_NOT_FOUND }, 409);
    }
    throw error;
  }
}
