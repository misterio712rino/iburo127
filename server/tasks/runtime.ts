import "server-only";

import { clientCaseService } from "@/server/client-cases/runtime";
import { TaskService } from "@/server/domain/tasks/service";
import { PrismaTaskRepository } from "@/server/repositories/prisma/task-repository";

export const taskService = new TaskService(
  clientCaseService,
  new PrismaTaskRepository(),
);
