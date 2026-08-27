import "server-only";

import { PRACTICUM_LESSONS } from "@/lib/platform/demo";
import { ClientCaseService } from "@/server/domain/client-cases/service";
import { PracticumService } from "@/server/domain/practicum/service";
import { PrismaClientCaseRepository } from "@/server/repositories/prisma/client-case-repository";
import { PrismaPracticumProgressRepository } from "@/server/repositories/prisma/practicum-progress-repository";

const lessonIds = PRACTICUM_LESSONS.map((lesson) => lesson.id);
const lessonIdSet = new Set(lessonIds);

const clientCaseService = new ClientCaseService(new PrismaClientCaseRepository());
const practicumRepository = new PrismaPracticumProgressRepository();

export const practicumService = new PracticumService(
  clientCaseService,
  practicumRepository,
  { lessonIds, lessonIdSet },
);
