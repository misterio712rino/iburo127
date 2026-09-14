import "server-only";

import { notificationService } from "@/server/notifications/runtime";
import { PrismaTaskReminderSource } from "@/server/repositories/prisma/task-reminder-source";
import { TaskReminderWorker } from "@/server/tasks/reminder-worker";

let worker: TaskReminderWorker | undefined;

export function getTaskReminderWorker() {
  worker ??= new TaskReminderWorker(
    new PrismaTaskReminderSource(),
    notificationService,
  );
  return worker;
}
