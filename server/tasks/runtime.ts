import "server-only";

import { TaskService } from "@/server/domain/tasks/service";
import { PrismaTaskRepository } from "@/server/repositories/prisma/task-repository";

export const taskService = new TaskService(new PrismaTaskRepository());
