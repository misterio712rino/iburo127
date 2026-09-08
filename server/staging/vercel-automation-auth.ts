import { createHash, timingSafeEqual } from "node:crypto";

export const IB_STAGING_CONTROL_HEADER = "x-iburo-staging-control";

const MIN_AUTOMATION_SECRET_LENGTH = 16;
const MAX_AUTOMATION_SECRET_LENGTH = 512;

type EnvironmentLike = Readonly<Record<string, string | undefined>>;

function safeAutomationSecret(value: string | null | undefined): string | null {
  if (!value) return null;
  if (
    value.length < MIN_AUTOMATION_SECRET_LENGTH ||
    value.length > MAX_AUTOMATION_SECRET_LENGTH ||
    value !== value.trim() ||
    /[\r\n\0]/.test(value)
  ) {
    return null;
  }
  return value;
}

function digest(value: string) {
  return createHash("sha256").update(value, "utf8").digest();
}

export function isAuthorizedVercelAutomationRequest(
  request: Pick<Request, "headers">,
  env: EnvironmentLike = process.env,
): boolean {
  const expected = safeAutomationSecret(env.VERCEL_AUTOMATION_BYPASS_SECRET);
  const provided = safeAutomationSecret(request.headers.get(IB_STAGING_CONTROL_HEADER));
  if (!expected || !provided) return false;
  return timingSafeEqual(digest(provided), digest(expected));
}
