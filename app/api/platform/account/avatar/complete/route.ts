import { createProductionSessionProvider } from "@/server/auth/production-session-provider";
import { UNAUTHENTICATED } from "@/server/auth/runtime";
import { readBoundedJsonBody } from "@/server/http/bounded-json-body";
import {
  ACCOUNT_AVATAR_INVALID_INPUT,
  ACCOUNT_AVATAR_NOT_FOUND,
  completeCurrentAccountAvatarUpload,
} from "@/server/account/avatar";

export async function POST(request: Request) {
  const bodyResult = await readBoundedJsonBody(request);
  if (!bodyResult.ok) return bodyResult.response;
  const objectKey = bodyResult.value && typeof bodyResult.value === "object" && !Array.isArray(bodyResult.value)
    ? (bodyResult.value as Record<string, unknown>).objectKey
    : undefined;

  try {
    const result = await completeCurrentAccountAvatarUpload(createProductionSessionProvider(), objectKey);
    return Response.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof Error && error.message === UNAUTHENTICATED) {
      return Response.json({ code: UNAUTHENTICATED }, { status: 401 });
    }
    if (error instanceof Error && error.message === ACCOUNT_AVATAR_NOT_FOUND) {
      return Response.json({ code: ACCOUNT_AVATAR_NOT_FOUND }, { status: 409 });
    }
    if (error instanceof Error && error.message === ACCOUNT_AVATAR_INVALID_INPUT) {
      return Response.json({ code: ACCOUNT_AVATAR_INVALID_INPUT }, { status: 400 });
    }
    throw error;
  }
}
