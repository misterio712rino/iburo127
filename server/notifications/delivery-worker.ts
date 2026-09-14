import type { NotificationRepository } from "@/server/domain/notifications/contracts";
import {
  EMAIL_DELIVERY_FAILED,
  type TransactionalEmailDelivery,
} from "@/server/email/yandex-postbox-core";

export const NOTIFICATION_DELIVERY_RECIPIENT_UNAVAILABLE =
  "NOTIFICATION_DELIVERY_RECIPIENT_UNAVAILABLE";
export const NOTIFICATION_DELIVERY_FAILED = "NOTIFICATION_DELIVERY_FAILED";

const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000, 6 * 60 * 60_000] as const;

function isSafeEmailAddress(value: string | null): value is string {
  return Boolean(
    value &&
      value.length <= 254 &&
      !/[\r\n\0]/.test(value) &&
      /^[^\s@]+@[^\s@]+$/.test(value),
  );
}

function normalizeErrorCode(error: unknown) {
  if (
    error instanceof Error &&
    error.message.startsWith(`${EMAIL_DELIVERY_FAILED}:`) &&
    error.message.length <= 100 &&
    /^[A-Z0-9_:]+$/.test(error.message)
  ) {
    return error.message;
  }
  return NOTIFICATION_DELIVERY_FAILED;
}

export function notificationDeliveryRetryDelayMs(attemptCount: number) {
  const index = Math.max(0, Math.min(RETRY_DELAYS_MS.length - 1, attemptCount - 1));
  return RETRY_DELAYS_MS[index];
}

export type NotificationDeliveryBatchResult = {
  inspected: number;
  sent: number;
  retryScheduled: number;
  dead: number;
  leaseLost: number;
};

export class NotificationDeliveryWorker {
  constructor(
    private readonly repository: NotificationRepository,
    private readonly emailDelivery: TransactionalEmailDelivery,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async processBatch(input: {
    limit: number;
    leaseMs: number;
    maxAttempts: number;
  }): Promise<NotificationDeliveryBatchResult> {
    const result: NotificationDeliveryBatchResult = {
      inspected: 0,
      sent: 0,
      retryScheduled: 0,
      dead: 0,
      leaseLost: 0,
    };

    for (let index = 0; index < input.limit; index += 1) {
      const claimedAt = this.now();
      const delivery = await this.repository.claimDueEmailDelivery({
        now: claimedAt,
        leaseUntil: new Date(claimedAt.getTime() + input.leaseMs),
      });
      if (!delivery) break;
      result.inspected += 1;

      if (!isSafeEmailAddress(delivery.recipientEmail)) {
        const marked = await this.repository.markEmailDeliveryDead({
          deliveryId: delivery.id,
          leaseToken: delivery.leaseToken,
          errorCode: NOTIFICATION_DELIVERY_RECIPIENT_UNAVAILABLE,
        });
        if (marked) result.dead += 1;
        else result.leaseLost += 1;
        continue;
      }

      try {
        await this.emailDelivery.send({
          to: delivery.recipientEmail,
          subject: delivery.title,
          text: delivery.body,
        });
      } catch (error) {
        const errorCode = normalizeErrorCode(error);
        if (delivery.attemptCount >= input.maxAttempts) {
          const marked = await this.repository.markEmailDeliveryDead({
            deliveryId: delivery.id,
            leaseToken: delivery.leaseToken,
            errorCode,
          });
          if (marked) result.dead += 1;
          else result.leaseLost += 1;
          continue;
        }

        const retryBase = this.now();
        const marked = await this.repository.rescheduleEmailDelivery({
          deliveryId: delivery.id,
          leaseToken: delivery.leaseToken,
          nextAttemptAt: new Date(
            retryBase.getTime() + notificationDeliveryRetryDelayMs(delivery.attemptCount),
          ),
          errorCode,
        });
        if (marked) result.retryScheduled += 1;
        else result.leaseLost += 1;
        continue;
      }

      const marked = await this.repository.markEmailDeliverySent({
        deliveryId: delivery.id,
        leaseToken: delivery.leaseToken,
        sentAt: this.now(),
        providerMessageId: null,
      });
      if (marked) result.sent += 1;
      else result.leaseLost += 1;
    }

    return result;
  }
}
