import { randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import type { NotificationType } from "@/server/domain/notifications/taxonomy";
import { buildCaseActivityWrite } from "@/server/repositories/prisma/case-activity-write";

const INTERNAL_CASE_REFERENCE_PATTERN = /\bIBR?-[A-Z0-9][A-Z0-9_-]*\b/gi;
const UNASSIGNED_CASE_NUMBER = "Номер дела ещё не присвоен";

export function sanitizeCaseNotificationText(value: string) {
  return value.replace(INTERNAL_CASE_REFERENCE_PATTERN, UNASSIGNED_CASE_NUMBER);
}

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
 * Internal IB/IBR identifiers are stripped at the persistence boundary so
 * they cannot be presented as court case numbers by any notification producer.
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
        title: sanitizeCaseNotificationText(input.title),
        body: sanitizeCaseNotificationText(input.body),
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
