export const NOTIFICATION_INVALID_TYPE = "NOTIFICATION_INVALID_TYPE";

export const NOTIFICATION_TYPES = [
  "questionnaire.reminder",
  "questionnaire.completed",
  "practicum.lesson_available",
  "practicum.completed",
  "task.assigned",
  "task.due_soon",
  "task.overdue",
  "document.ready_for_review",
  "document.reviewed",
  "case.stage_changed",
  "security.mfa_required",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

const TYPE_SET = new Set<string>(NOTIFICATION_TYPES);

export function requireNotificationType(type: string): NotificationType {
  const normalized = type.trim();
  if (!TYPE_SET.has(normalized)) throw new Error(NOTIFICATION_INVALID_TYPE);
  return normalized as NotificationType;
}
