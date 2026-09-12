export const NOTIFICATION_NOT_FOUND = "NOTIFICATION_NOT_FOUND";
export const NOTIFICATION_DEDUPE_CONFLICT = "NOTIFICATION_DEDUPE_CONFLICT";

export type NotificationDeliveryChannel = "EMAIL";
export type NotificationDeliveryStatus = "PENDING" | "PROCESSING" | "SENT" | "DEAD";

export type NotificationRecord = {
  id: string;
  userId: string;
  clientCaseId: string | null;
  dedupeKey: string | null;
  type: string;
  title: string;
  body: string;
  readAt: Date | null;
  createdAt: Date;
};

export type CreateNotificationInput = {
  userId: string;
  clientCaseId?: string | null;
  dedupeKey?: string | null;
  type: string;
  title: string;
  body: string;
  deliveryChannels?: readonly NotificationDeliveryChannel[];
};

export type ClaimedEmailDelivery = {
  id: string;
  notificationId: string;
  leaseToken: string;
  attemptCount: number;
  recipientEmail: string | null;
  title: string;
  body: string;
};

export interface NotificationRepository {
  listForUser(userId: string, limit: number): Promise<readonly NotificationRecord[]>;
  markRead(userId: string, notificationId: string): Promise<NotificationRecord>;
  markAllRead(userId: string): Promise<number>;
  create(input: CreateNotificationInput): Promise<NotificationRecord>;
  claimDueEmailDelivery(input: {
    now: Date;
    leaseUntil: Date;
  }): Promise<ClaimedEmailDelivery | null>;
  markEmailDeliverySent(input: {
    deliveryId: string;
    leaseToken: string;
    sentAt: Date;
    providerMessageId?: string | null;
  }): Promise<boolean>;
  rescheduleEmailDelivery(input: {
    deliveryId: string;
    leaseToken: string;
    nextAttemptAt: Date;
    errorCode: string;
  }): Promise<boolean>;
  markEmailDeliveryDead(input: {
    deliveryId: string;
    leaseToken: string;
    errorCode: string;
  }): Promise<boolean>;
}
