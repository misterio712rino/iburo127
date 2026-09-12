import "server-only";

import { PRACTICUM_LESSON_IDS } from "@/lib/platform/practicum-content";
import { ClientCaseService } from "@/server/domain/client-cases/service";
import { PracticumWorkspaceService } from "@/server/domain/practicum/workspace-service";
import { PrismaClientCaseRepository } from "@/server/repositories/prisma/client-case-repository";
import { PrismaPracticumWorkspaceRepository } from "@/server/repositories/prisma/practicum-workspace-repository";

const clientCaseService = new ClientCaseService(new PrismaClientCaseRepository());
const workspaceRepository = new PrismaPracticumWorkspaceRepository();

export const practicumWorkspaceService = new PracticumWorkspaceService(
  clientCaseService,
  workspaceRepository,
  { lessonIdSet: new Set(PRACTICUM_LESSON_IDS) },
);
