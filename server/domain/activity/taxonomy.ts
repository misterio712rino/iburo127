import type { ActivityMetadata } from "@/server/domain/activity/contracts";

export const ACTIVITY_INVALID_METADATA = "ACTIVITY_INVALID_METADATA";
export const ACTIVITY_INVALID_TYPE = "ACTIVITY_INVALID_TYPE";

export const CASE_ACTIVITY_TYPES = [
  "auth.session.started",
  "auth.mfa.enrolled",
  "questionnaire.started",
  "questionnaire.answer.updated",
  "questionnaire.section.completed",
  "questionnaire.completed",
  "practicum.lesson.completed",
  "practicum.completed",
  "task.status.changed",
  "document.regenerated",
  "document.sent_for_review",
  "document.reviewed",
  "file.upload.registered",
  "file.upload.completed",
  "file.download.authorized",
  "notification.created",
  "ai.request.accepted",
  "ai.response.completed",
  "ai.response.restricted",
  "ai.response.failed",
] as const;

export type CaseActivityType = (typeof CASE_ACTIVITY_TYPES)[number];

const TYPE_SET = new Set<string>(CASE_ACTIVITY_TYPES);

/**
 * Activity metadata is intentionally restricted to identifiers/status-like
 * scalar values. Never put questionnaire answers, document contents, file
 * contents, auth secrets, tokens, passwords, emails or phone numbers here.
 */
const SAFE_METADATA_KEYS = new Set([
  "questionnaireVersion",
  "schemaVersion",
  "sectionId",
  "fieldId",
  "lessonId",
  "taskId",
  "fromStatus",
  "toStatus",
  "documentCode",
  "documentStatus",
  "fileId",
  "storageProvider",
  "notificationId",
  "notificationType",
  "authProvider",
  "auditId",
]);

export function requireCaseActivityType(type: string): CaseActivityType {
  const normalized = type.trim();
  if (!TYPE_SET.has(normalized)) throw new Error(ACTIVITY_INVALID_TYPE);
  return normalized as CaseActivityType;
}

export function sanitizeActivityMetadata(
  metadata?: ActivityMetadata,
): ActivityMetadata | undefined {
  if (!metadata) return undefined;

  const safe: ActivityMetadata = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (!SAFE_METADATA_KEYS.has(key)) throw new Error(ACTIVITY_INVALID_METADATA);
    if (typeof value === "string" && value.length > 200) {
      throw new Error(ACTIVITY_INVALID_METADATA);
    }
    safe[key] = value;
  }

  return safe;
}
