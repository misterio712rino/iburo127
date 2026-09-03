import { createProductionSessionProvider } from "@/server/auth/production-session-provider";
import { UNAUTHENTICATED } from "@/server/auth/runtime";
import { readBoundedJsonBody } from "@/server/http/bounded-json-body";
import { privateJsonResponse } from "@/server/http/private-json";
import {
  ACCOUNT_PROFILE_INVALID_DISPLAY_NAME,
  updateCurrentAccountDisplayName,
} from "@/server/account/operations";

export async function PATCH(request: Request) {
  const bodyResult = await readBoundedJsonBody(request);
  if (!bodyResult.ok) return bodyResult.response;
  const displayName = bodyResult.value && typeof bodyResult.value === "object" && !Array.isArray(bodyResult.value)
    ? (bodyResult.value as Record<string, unknown>).displayName
    : undefined;

  try {
    return privateJsonResponse(
      await updateCurrentAccountDisplayName(createProductionSessionProvider(), displayName),
    );
  } catch (error) {
    if (error instanceof Error && error.message === UNAUTHENTICATED) {
      return privateJsonResponse({ code: UNAUTHENTICATED }, 401);
    }
    if (error instanceof Error && error.message === ACCOUNT_PROFILE_INVALID_DISPLAY_NAME) {
      return privateJsonResponse({ code: ACCOUNT_PROFILE_INVALID_DISPLAY_NAME }, 400);
    }
    throw error;
  }
}
