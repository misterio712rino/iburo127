export const NOTIFICATION_NOT_FOUND = "NOTIFICATION_NOT_FOUND";

export type NotificationRecord = {
  id: string;
  userId: string;
  clientCaseId: string | null;
  type: string;
  title: string;
  body: string;
  readAt: Date | null;
  createdAt: Date;
};

export interface NotificationRepository {
  listForUser(userId: string, limit: number): Promise<readonly NotificationRecord[]>;
  markRead(userId: string, notificationId: string): Promise<NotificationRecord>;
  create(input: {
    userId: string;
    clientCaseId?: string | null;
    type: string;
    title: string;
    body: string;
  }): Promise<NotificationRecord>;
}
