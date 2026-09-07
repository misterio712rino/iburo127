import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { getPrismaClient } from "@/server/database/prisma";
import {
  PRACTICUM_WORKSPACE_FORBIDDEN,
  PRACTICUM_WORKSPACE_LAWYER_NOT_ASSIGNED,
  PRACTICUM_WORKSPACE_NOT_FOUND,
  PRACTICUM_WORKSPACE_STATE_CONFLICT,
  type PracticumHomeworkRecord,
  type PracticumHomeworkRevisionRecord,
  type PracticumLessonMessageRecord,
  type PracticumLessonWorkspaceRecord,
  type PracticumWorkspaceRepository,
} from "@/server/domain/practicum/workspace-contracts";
import { buildCaseActivityWrite } from "@/server/repositories/prisma/case-activity-write";
import { createCaseNotificationInTransaction } from "@/server/repositories/prisma/case-notification-write";

function toHomeworkRecord(row: PracticumHomeworkRecord): PracticumHomeworkRecord {
  return row;
}

function toRevisionRecord(row: PracticumHomeworkRevisionRecord): PracticumHomeworkRevisionRecord {
  return row;
}

function toMessageRecord(row: PracticumLessonMessageRecord): PracticumLessonMessageRecord {
  return row;
}

async function getWorkspaceInTransaction(
  tx: Prisma.TransactionClient,
  input: { clientCaseId: string; lessonId: string },
): Promise<PracticumLessonWorkspaceRecord> {
  const homework = await tx.casePracticumHomework.findUnique({
    where: {
      clientCaseId_lessonId: {
        clientCaseId: input.clientCaseId,
        lessonId: input.lessonId,
      },
    },
  });

  const [revisions, messages] = await Promise.all([
    homework
      ? tx.casePracticumHomeworkRevision.findMany({
          where: { homeworkId: homework.id },
          orderBy: { revisionNumber: "asc" },
        })
      : Promise.resolve([]),
    tx.casePracticumLessonMessage.findMany({
      where: {
        clientCaseId: input.clientCaseId,
        lessonId: input.lessonId,
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    }),
  ]);

  return {
    homework: homework ? toHomeworkRecord(homework) : null,
    revisions: revisions.map(toRevisionRecord),
    messages: messages.map(toMessageRecord),
  };
}

function homeworkCanBeEdited(status: PracticumHomeworkRecord["status"]) {
  return status === "NOT_STARTED" || status === "DRAFT" || status === "CHANGES_REQUESTED";
}

export class PrismaPracticumWorkspaceRepository implements PracticumWorkspaceRepository {
  async getLessonWorkspace(input: { clientCaseId: string; lessonId: string }) {
    const prisma = getPrismaClient();
    return prisma.$transaction((tx) => getWorkspaceInTransaction(tx, input));
  }

  async saveHomeworkDraft(input: {
    clientCaseId: string;
    lessonId: string;
    answerText: string;
    actorUserId: string;
  }) {
    const prisma = getPrismaClient();

    return prisma.$transaction(async (tx) => {
      const current = await tx.casePracticumHomework.findUnique({
        where: {
          clientCaseId_lessonId: {
            clientCaseId: input.clientCaseId,
            lessonId: input.lessonId,
          },
        },
      });

      if (current && !homeworkCanBeEdited(current.status)) {
        throw new Error(PRACTICUM_WORKSPACE_STATE_CONFLICT);
      }

      if (!current) {
        const created = await tx.casePracticumHomework.create({
          data: {
            clientCaseId: input.clientCaseId,
            lessonId: input.lessonId,
            status: "DRAFT",
            draftText: input.answerText,
          },
        });
        return toHomeworkRecord(created);
      }

      const updated = await tx.casePracticumHomework.update({
        where: { id: current.id },
        data: {
          status: "DRAFT",
          draftText: input.answerText,
          version: { increment: 1 },
        },
      });
      return toHomeworkRecord(updated);
    });
  }

  async submitHomework(input: {
    clientCaseId: string;
    lessonId: string;
    answerText: string;
    actorUserId: string;
  }) {
    const prisma = getPrismaClient();

    return prisma.$transaction(async (tx) => {
      let homework = await tx.casePracticumHomework.findUnique({
        where: {
          clientCaseId_lessonId: {
            clientCaseId: input.clientCaseId,
            lessonId: input.lessonId,
          },
        },
      });

      if (homework && !homeworkCanBeEdited(homework.status)) {
        throw new Error(PRACTICUM_WORKSPACE_STATE_CONFLICT);
      }

      if (!homework) {
        homework = await tx.casePracticumHomework.create({
          data: {
            clientCaseId: input.clientCaseId,
            lessonId: input.lessonId,
            status: "DRAFT",
            draftText: input.answerText,
          },
        });
      }

      const revisionAggregate = await tx.casePracticumHomeworkRevision.aggregate({
        where: { homeworkId: homework.id },
        _max: { revisionNumber: true },
      });
      const revisionNumber = (revisionAggregate._max.revisionNumber ?? 0) + 1;
      const now = new Date();

      await tx.casePracticumHomeworkRevision.create({
        data: {
          homeworkId: homework.id,
          revisionNumber,
          submittedByUserId: input.actorUserId,
          answerText: input.answerText,
          submittedAt: now,
        },
      });

      await tx.casePracticumHomework.update({
        where: { id: homework.id },
        data: {
          status: "SUBMITTED",
          draftText: input.answerText,
          submittedAt: now,
          reviewedAt: null,
          version: { increment: 1 },
        },
      });

      await tx.caseActivityEvent.create({
        data: buildCaseActivityWrite({
          clientCaseId: input.clientCaseId,
          actorUserId: input.actorUserId,
          type: "practicum.homework.submitted",
          metadata: {
            lessonId: input.lessonId,
            revisionNumber,
          },
        }),
      });

      const clientCase = await tx.clientCase.findUnique({
        where: { id: input.clientCaseId },
        select: { caseNumber: true, assignedLawyerId: true },
      });
      if (!clientCase) throw new Error(PRACTICUM_WORKSPACE_NOT_FOUND);

      if (clientCase.assignedLawyerId) {
        await createCaseNotificationInTransaction(tx, {
          userId: clientCase.assignedLawyerId,
          clientCaseId: input.clientCaseId,
          dedupeKey: `practicum.homework.submitted:${homework.id}:${revisionNumber}`,
          type: "practicum.homework.submitted",
          title: "Новое домашнее задание",
          body: `Клиент по делу ${clientCase.caseNumber} отправил домашнее задание по уроку.`,
        });
      }

      return getWorkspaceInTransaction(tx, input);
    });
  }

  async reviewHomework(input: {
    clientCaseId: string;
    lessonId: string;
    decision: "CHANGES_REQUESTED" | "ACCEPTED";
    comment: string;
    actorUserId: string;
  }) {
    const prisma = getPrismaClient();

    return prisma.$transaction(async (tx) => {
      const homework = await tx.casePracticumHomework.findUnique({
        where: {
          clientCaseId_lessonId: {
            clientCaseId: input.clientCaseId,
            lessonId: input.lessonId,
          },
        },
        include: {
          revisions: {
            orderBy: { revisionNumber: "desc" },
            take: 1,
          },
        },
      });

      if (!homework) throw new Error(PRACTICUM_WORKSPACE_NOT_FOUND);
      if (homework.status !== "SUBMITTED" && homework.status !== "IN_REVIEW") {
        throw new Error(PRACTICUM_WORKSPACE_STATE_CONFLICT);
      }

      const revision = homework.revisions[0];
      if (!revision || revision.reviewDecision || revision.reviewedAt) {
        throw new Error(PRACTICUM_WORKSPACE_STATE_CONFLICT);
      }

      const now = new Date();
      await tx.casePracticumHomeworkRevision.update({
        where: { id: revision.id },
        data: {
          reviewedByUserId: input.actorUserId,
          reviewDecision: input.decision,
          reviewComment: input.comment || null,
          reviewedAt: now,
        },
      });

      await tx.casePracticumHomework.update({
        where: { id: homework.id },
        data: {
          status: input.decision,
          reviewedAt: now,
          version: { increment: 1 },
        },
      });

      await tx.caseActivityEvent.create({
        data: buildCaseActivityWrite({
          clientCaseId: input.clientCaseId,
          actorUserId: input.actorUserId,
          type: "practicum.homework.reviewed",
          metadata: {
            lessonId: input.lessonId,
            revisionNumber: revision.revisionNumber,
            decision: input.decision,
          },
        }),
      });

      const clientCase = await tx.clientCase.findUnique({
        where: { id: input.clientCaseId },
        select: { clientId: true, caseNumber: true },
      });
      if (!clientCase) throw new Error(PRACTICUM_WORKSPACE_NOT_FOUND);

      await createCaseNotificationInTransaction(tx, {
        userId: clientCase.clientId,
        clientCaseId: input.clientCaseId,
        dedupeKey: `practicum.homework.reviewed:${revision.id}`,
        type: "practicum.homework.reviewed",
        title: input.decision === "ACCEPTED" ? "Домашнее задание принято" : "Домашнее задание требует доработки",
        body: `Юрист проверил домашнее задание по вашему делу ${clientCase.caseNumber}.`,
      });

      return getWorkspaceInTransaction(tx, input);
    });
  }

  async addLessonMessage(input: {
    clientCaseId: string;
    lessonId: string;
    body: string;
    actorUserId: string;
  }) {
    const prisma = getPrismaClient();

    return prisma.$transaction(async (tx) => {
      const clientCase = await tx.clientCase.findUnique({
        where: { id: input.clientCaseId },
        select: {
          clientId: true,
          assignedLawyerId: true,
          caseNumber: true,
        },
      });
      if (!clientCase) throw new Error(PRACTICUM_WORKSPACE_NOT_FOUND);

      let recipientUserId: string;
      if (input.actorUserId === clientCase.clientId) {
        if (!clientCase.assignedLawyerId) {
          throw new Error(PRACTICUM_WORKSPACE_LAWYER_NOT_ASSIGNED);
        }
        recipientUserId = clientCase.assignedLawyerId;
      } else if (
        clientCase.assignedLawyerId &&
        input.actorUserId === clientCase.assignedLawyerId
      ) {
        recipientUserId = clientCase.clientId;
      } else {
        throw new Error(PRACTICUM_WORKSPACE_FORBIDDEN);
      }

      const message = await tx.casePracticumLessonMessage.create({
        data: {
          clientCaseId: input.clientCaseId,
          lessonId: input.lessonId,
          authorUserId: input.actorUserId,
          body: input.body,
        },
      });

      await tx.caseActivityEvent.create({
        data: buildCaseActivityWrite({
          clientCaseId: input.clientCaseId,
          actorUserId: input.actorUserId,
          type: "practicum.lesson_message.created",
          metadata: {
            lessonId: input.lessonId,
            messageId: message.id,
          },
        }),
      });

      await createCaseNotificationInTransaction(tx, {
        userId: recipientUserId,
        clientCaseId: input.clientCaseId,
        dedupeKey: `practicum.lesson_message:${message.id}`,
        type: "practicum.lesson_message",
        title: input.actorUserId === clientCase.clientId ? "Новый вопрос по уроку" : "Ответ юриста по уроку",
        body: `Новое сообщение в Практикуме по делу ${clientCase.caseNumber}.`,
      });

      return toMessageRecord(message);
    });
  }
}
