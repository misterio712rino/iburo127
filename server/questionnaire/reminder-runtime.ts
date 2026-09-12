import "server-only";

import { notificationService } from "@/server/notifications/runtime";
import { PrismaQuestionnaireReminderSource } from "@/server/repositories/prisma/questionnaire-reminder-source";
import { QuestionnaireReminderWorker } from "@/server/questionnaire/reminder-worker";

let worker: QuestionnaireReminderWorker | undefined;

export function getQuestionnaireReminderWorker() {
  worker ??= new QuestionnaireReminderWorker(
    new PrismaQuestionnaireReminderSource(),
    notificationService,
  );
  return worker;
}
