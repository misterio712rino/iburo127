import type { AuthenticatedActor } from "@/server/domain/client-cases/contracts";
import type { NotificationRepository } from "@/server/domain/notifications/contracts";

export const NOTIFICATION_INVALID_INPUT = "NOTIFICATION_INVALID_INPUT";

function normalizeLimit(limit?: number) {
  if (limit === undefined) return 50;
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) return 50;
  return limit;
}

function requireText(value: string, maxLength: number) {
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) {
    throw new Error(NOTIFICATION_INVALID_INPUT);
  }
  return normalized;
}

export class NotificationService {
  constructor(private readonly repository: NotificationRepository) {}

  listForActor(actor: AuthenticatedActor, limit?: number) {
    return this.repository.listForUser(actor.userId, normalizeLimit(limit));
  }

  markRead(actor: AuthenticatedActor, notificationId: string) {
    return this.repository.markRead(actor.userId, requireText(notificationId, 100));
  }

  createSystem(input: {
    userId: string;
    clientCaseId?: string | null;
    type: string;
    title: string;
    body: string;
  }) {
    return this.repository.create({
      userId: requireText(input.userId, 100),
      clientCaseId: input.clientCaseId ?? null,
      type: requireText(input.type, 100),
      title: requireText(input.title, 200),
      body: requireText(input.body, 4000),
    });
  }
}
