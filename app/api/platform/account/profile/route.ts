import { createProductionSessionProvider } from "@/server/auth/production-session-provider";
import { UNAUTHENTICATED } from "@/server/auth/runtime";
import { readBoundedJsonBody } from "@/server/http/bounded-json-body";
import { privateJsonResponse } from "@/server/http/private-json";
import {
  ACCOUNT_PROFILE_EMAIL_CONFLICT,
  ACCOUNT_PROFILE_INVALID_DISPLAY_NAME,
  ACCOUNT_PROFILE_INVALID_EMAIL,
  ACCOUNT_PROFILE_INVALID_PHONE,
  updateCurrentAccountContacts,
  updateCurrentAccountDisplayName,
} from "@/server/account/operations";

export async function PATCH(request: Request) {
  const bodyResult = await readBoundedJsonBody(request);
  if (!bodyResult.ok) return bodyResult.response;
  const body = bodyResult.value && typeof bodyResult.value === "object" && !Array.isArray(bodyResult.value)
    ? (bodyResult.value as Record<string, unknown>)
    : null;

  if (!body) return privateJsonResponse({ code: "ACCOUNT_PROFILE_INVALID_UPDATE" }, 400);

  try {
    const sessionProvider = createProductionSessionProvider();

    if (Object.prototype.hasOwnProperty.call(body, "displayName")) {
      return privateJsonResponse(
        await updateCurrentAccountDisplayName(sessionProvider, body.displayName),
      );
    }

    if (
      Object.prototype.hasOwnProperty.call(body, "email") ||
      Object.prototype.hasOwnProperty.call(body, "phone")
    ) {
      const input: { email?: unknown; phone?: unknown } = {};
      if (Object.prototype.hasOwnProperty.call(body, "email")) input.email = body.email;
      if (Object.prototype.hasOwnProperty.call(body, "phone")) input.phone = body.phone;
      return privateJsonResponse(await updateCurrentAccountContacts(sessionProvider, input));
    }

    return privateJsonResponse({ code: "ACCOUNT_PROFILE_INVALID_UPDATE" }, 400);
  } catch (error) {
    if (error instanceof Error && error.message === UNAUTHENTICATED) {
      return privateJsonResponse({ code: UNAUTHENTICATED }, 401);
    }
    if (error instanceof Error && error.message === ACCOUNT_PROFILE_INVALID_DISPLAY_NAME) {
      return privateJsonResponse({ code: ACCOUNT_PROFILE_INVALID_DISPLAY_NAME }, 400);
    }
    if (error instanceof Error && error.message === ACCOUNT_PROFILE_INVALID_EMAIL) {
      return privateJsonResponse({ code: ACCOUNT_PROFILE_INVALID_EMAIL }, 400);
    }
    if (error instanceof Error && error.message === ACCOUNT_PROFILE_INVALID_PHONE) {
      return privateJsonResponse({ code: ACCOUNT_PROFILE_INVALID_PHONE }, 400);
    }
    if (error instanceof Error && error.message === ACCOUNT_PROFILE_EMAIL_CONFLICT) {
      return privateJsonResponse({ code: ACCOUNT_PROFILE_EMAIL_CONFLICT }, 409);
    }
    throw error;
  }
}
