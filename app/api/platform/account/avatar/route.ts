import { privateResponse } from "@/server/http/private-json";
import {
  ACCOUNT_AVATAR_NOT_FOUND,
  createCurrentAccountAvatarDownload,
} from "@/server/account/avatar";
import { UNAUTHENTICATED } from "@/server/auth/runtime";

const AVATAR_FETCH_TIMEOUT_MS = 15_000;

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
    if (!["image/jpeg", "image/png", "image/webp"].includes(contentType)) {
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
