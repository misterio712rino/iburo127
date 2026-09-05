import type { AuthenticatedActor } from "@/server/domain/client-cases/contracts";
import type {
  NotificationDeliveryChannel,
  NotificationRepository,
} from "@/server/domain/notifications/contracts";
import { requireNotificationType } from "@/server/domain/notifications/taxonomy";

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

function requireOptionalText(value: string | null | undefined, maxLength: number) {
  if (value === undefined || value === null) return null;
  return requireText(value, maxLength);
}

function normalizeDeliveryChannels(
  channels?: readonly NotificationDeliveryChannel[],
): readonly NotificationDeliveryChannel[] {
  if (!channels?.length) return [];
  const unique = [...new Set(channels)];
  if (unique.some((channel) => channel !== "EMAIL")) {
    throw new Error(NOTIFICATION_INVALID_INPUT);
  }
  return unique;
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
    dedupeKey?: string | null;
    type: string;
    title: string;
    body: string;
    deliveryChannels?: readonly NotificationDeliveryChannel[];
  }) {
    const deliveryChannels = normalizeDeliveryChannels(input.deliveryChannels);
    const dedupeKey = requireOptionalText(input.dedupeKey, 160);
    const title = requireText(input.title, 200);

    if (deliveryChannels.length > 0 && !dedupeKey) {
      throw new Error(NOTIFICATION_INVALID_INPUT);
    }
    if (deliveryChannels.includes("EMAIL") && title.length > 180) {
      throw new Error(NOTIFICATION_INVALID_INPUT);
    }

    return this.repository.create({
      userId: requireText(input.userId, 100),
      clientCaseId: input.clientCaseId ?? null,
      dedupeKey,
      type: requireNotificationType(input.type),
      title,
      body: requireText(input.body, 4000),
      deliveryChannels,
    });
  }
}
