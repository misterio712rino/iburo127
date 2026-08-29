import "server-only";

import { getPrismaClient } from "@/server/database/prisma";
import type { AuthenticatedActor } from "@/server/domain/client-cases/contracts";
import {
  TASK_NOT_FOUND,
  TASK_VERSION_CONFLICT,
  type CreateTaskRepositoryInput,
  type TaskRecord,
  type TaskRepository,
  type TaskStatus,
} from "@/server/domain/tasks/contracts";
import { buildCaseActivityWrite } from "@/server/repositories/prisma/case-activity-write";

function actorTaskWhere(actor: AuthenticatedActor) {
  if (actor.roles.includes("MANAGER")) {
    return {
      clientCase: {
        is: {
          clientId: { not: actor.userId },
        },
      },
    };
  }
  if (actor.roles.includes("LAWYER")) {
    return {
      assigneeId: actor.userId,
      clientCase: {
        is: {
          assignedLawyerId: actor.userId,
          clientId: { not: actor.userId },
        },
      },
    };
  }
  return null;
}

function actorCaseWhere(actor: AuthenticatedActor) {
  if (actor.roles.includes("MANAGER")) {
    return {
      clientId: { not: actor.userId },
    };
  }
  if (actor.roles.includes("LAWYER")) {
    return {
      assignedLawyerId: actor.userId,
      clientId: { not: actor.userId },
    };
  }
  return null;
}

function toRecord(row: {
  id: string;
  clientCaseId: string;
  assigneeId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  dueAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}): TaskRecord {
  return row;
}

export class PrismaTaskRepository implements TaskRepository {
  async getAccessible(actor: AuthenticatedActor, taskId: string) {
    const scope = actorTaskWhere(actor);
    if (!scope) return null;

    const prisma = getPrismaClient();
    const row = await prisma.caseTask.findFirst({ where: { id: taskId, ...scope } });
    return row ? toRecord(row) : null;
  }

  async listAccessible(actor: AuthenticatedActor) {
    const scope = actorTaskWhere(actor);
    if (!scope) return [];

    const prisma = getPrismaClient();
    const rows = await prisma.caseTask.findMany({
      where: scope,
      orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
    });
    return rows.map(toRecord);
  }

  async create(input: CreateTaskRepositoryInput) {
    const caseScope = actorCaseWhere(input.actor);
    if (!caseScope) throw new Error(TASK_NOT_FOUND);

    const prisma = getPrismaClient();
    return prisma.$transaction(async (tx) => {
      const clientCase = await tx.clientCase.findFirst({
        where: {
          id: input.clientCaseId,
          assignedLawyerId: input.assigneeId,
          ...caseScope,
        },
        select: { id: true, assignedLawyerId: true },
      });
      if (!clientCase?.assignedLawyerId || clientCase.assignedLawyerId !== input.assigneeId) {
        throw new Error(TASK_NOT_FOUND);
      }

      const row = await tx.caseTask.create({
        data: {
          clientCaseId: clientCase.id,
          assigneeId: clientCase.assignedLawyerId,
          title: input.title,
          description: input.description,
          dueAt: input.dueAt,
          status: "NEW",
        },
      });

      await tx.caseActivityEvent.create({
        data: buildCaseActivityWrite({
          clientCaseId: clientCase.id,
          actorUserId: input.actor.userId,
          type: "task.created",
          metadata: {
            taskId: row.id,
            assigneeId: row.assigneeId,
            dueAt: row.dueAt?.toISOString() ?? null,
          },
        }),
      });

      return toRecord(row);
    });
  }

  async updateStatus(input: {
    actor: AuthenticatedActor;
    taskId: string;
    status: TaskStatus;
    expectedVersion: number;
  }) {
    const scope = actorTaskWhere(input.actor);
    if (!scope) throw new Error(TASK_NOT_FOUND);

    const prisma = getPrismaClient();
    return prisma.$transaction(async (tx) => {
      const current = await tx.caseTask.findFirst({
        where: { id: input.taskId, ...scope },
      });
      if (!current) throw new Error(TASK_NOT_FOUND);
      if (current.version !== input.expectedVersion) throw new Error(TASK_VERSION_CONFLICT);

      if (current.status === input.status) return toRecord(current);

      const now = new Date();
      const updated = await tx.caseTask.updateMany({
        where: {
          id: current.id,
          version: input.expectedVersion,
          ...scope,
        },
        data: {
          status: input.status,
          startedAt: input.status === "WORKING" ? current.startedAt ?? now : current.startedAt,
          completedAt: input.status === "DONE" ? current.completedAt ?? now : null,
          version: { increment: 1 },
        },
      });

      if (updated.count !== 1) throw new Error(TASK_VERSION_CONFLICT);

      await tx.taskStatusEvent.create({
        data: {
          taskId: current.id,
          actorUserId: input.actor.userId,
          fromStatus: current.status,
          toStatus: input.status,
        },
      });
      await tx.caseActivityEvent.create({
        data: buildCaseActivityWrite({
          clientCaseId: current.clientCaseId,
          actorUserId: input.actor.userId,
          type: "task.status.changed",
          metadata: {
            taskId: current.id,
            fromStatus: current.status,
            toStatus: input.status,
          },
        }),
      });

      const row = await tx.caseTask.findUnique({ where: { id: current.id } });
      if (!row) throw new Error(TASK_NOT_FOUND);
      return toRecord(row);
    });
  }
}
