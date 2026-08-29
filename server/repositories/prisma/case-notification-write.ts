import { randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import type { NotificationType } from "@/server/domain/notifications/taxonomy";
import { buildCaseActivityWrite } from "@/server/repositories/prisma/case-activity-write";

export type CaseNotificationInput = {
  userId: string;
  clientCaseId: string;
  dedupeKey: string;
  type: NotificationType;
  title: string;
  body: string;
};

/**
 * Writes a case notification and its audit event inside an existing Prisma
 * transaction. Duplicate dedupe keys become a no-op, so retrying a versioned
 * domain mutation cannot create duplicate notifications or audit events.
 */
export async function createCaseNotificationInTransaction(
  tx: Prisma.TransactionClient,
  input: CaseNotificationInput,
): Promise<boolean> {
  const notificationId = randomUUID();
  const inserted = await tx.notification.createMany({
    data: [
      {
        id: notificationId,
        userId: input.userId,
        clientCaseId: input.clientCaseId,
        dedupeKey: input.dedupeKey,
        type: input.type,
        title: input.title,
        body: input.body,
      },
    ],
    skipDuplicates: true,
  });

  if (inserted.count !== 1) return false;

  await tx.caseActivityEvent.create({
    data: buildCaseActivityWrite({
      clientCaseId: input.clientCaseId,
      actorUserId: null,
      type: "notification.created",
      metadata: {
        notificationId,
        notificationType: input.type,
      },
    }),
  });

  return true;
}
