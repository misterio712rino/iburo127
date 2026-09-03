import { createProductionSessionProvider } from "@/server/auth/production-session-provider";
import { UNAUTHENTICATED } from "@/server/auth/runtime";
import { readBoundedJsonBody } from "@/server/http/bounded-json-body";
import { privateJsonResponse } from "@/server/http/private-json";
import {
  ACCOUNT_AVATAR_INVALID_INPUT,
  createCurrentAccountAvatarUpload,
} from "@/server/account/avatar";

export async function POST(request: Request) {
  const bodyResult = await readBoundedJsonBody(request);
  if (!bodyResult.ok) return bodyResult.response;
  const body = bodyResult.value && typeof bodyResult.value === "object" && !Array.isArray(bodyResult.value)
    ? bodyResult.value as Record<string, unknown>
    : {};

  try {
    return privateJsonResponse(
      await createCurrentAccountAvatarUpload(createProductionSessionProvider(), {
        mimeType: body.mimeType,
        sizeBytes: body.sizeBytes,
      }),
    );
  } catch (error) {
    if (error instanceof Error && error.message === UNAUTHENTICATED) {
      return privateJsonResponse({ code: UNAUTHENTICATED }, 401);
    }
    if (error instanceof Error && error.message === ACCOUNT_AVATAR_INVALID_INPUT) {
      return privateJsonResponse({ code: ACCOUNT_AVATAR_INVALID_INPUT }, 400);
    }
    throw error;
  }
}
