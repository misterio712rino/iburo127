import { getTransactionalEmailDelivery } from "@/server/email/runtime";
import { readBoundedJsonBody } from "@/server/http/bounded-json-body";
import { privateJsonResponse } from "@/server/http/private-json";
import { evaluatePlatformMutationOrigin } from "@/server/http/trusted-mutation-origin";
import {
  PUBLIC_CONTACT_INVALID,
  formatPublicContactEmail,
  parsePublicContactRequest,
} from "@/server/public-contact/core";

const PUBLIC_CONTACT_BODY_MAX_BYTES = 8 * 1024;
const PUBLIC_CONTACT_RECIPIENT = "127pro@mail.ru";
const PUBLIC_CONTACT_SUBJECT = "Новая заявка с сайта iБюро";

function invalidRequestResponse(): Response {
  return privateJsonResponse(
    { ok: false, error: { code: "INVALID_CONTACT_REQUEST" } },
    400,
  );
}

export async function POST(request: Request): Promise<Response> {
  const originDecision = evaluatePlatformMutationOrigin(request);
  if (!originDecision.allowed) {
    return privateJsonResponse(
      { ok: false, error: { code: originDecision.code } },
      originDecision.status,
    );
  }

  const body = await readBoundedJsonBody(request, PUBLIC_CONTACT_BODY_MAX_BYTES);
  if (!body.ok) return body.response;

  let contactRequest;
  try {
    contactRequest = parsePublicContactRequest(body.value);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith(`${PUBLIC_CONTACT_INVALID}:`)) {
      return invalidRequestResponse();
    }
    return privateJsonResponse(
      { ok: false, error: { code: "CONTACT_REQUEST_FAILED" } },
      500,
    );
  }

  if (contactRequest.spam) {
    return privateJsonResponse({ ok: true });
  }

  try {
    await getTransactionalEmailDelivery().send({
      to: PUBLIC_CONTACT_RECIPIENT,
      subject: PUBLIC_CONTACT_SUBJECT,
      text: formatPublicContactEmail(contactRequest),
    });
  } catch {
    return privateJsonResponse(
      { ok: false, error: { code: "CONTACT_DELIVERY_UNAVAILABLE" } },
      503,
    );
  }

  return privateJsonResponse({ ok: true });
}
