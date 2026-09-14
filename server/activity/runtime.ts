import "server-only";

import { CaseActivityService } from "@/server/domain/activity/service";
import { ClientCaseService } from "@/server/domain/client-cases/service";
import { PrismaCaseActivityRepository } from "@/server/repositories/prisma/activity-repository";
import { PrismaClientCaseRepository } from "@/server/repositories/prisma/client-case-repository";

export const caseActivityService = new CaseActivityService(
  new ClientCaseService(new PrismaClientCaseRepository()),
  new PrismaCaseActivityRepository(),
);
