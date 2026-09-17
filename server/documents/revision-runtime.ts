import "server-only";

import { ClientCaseService } from "@/server/domain/client-cases/service";
import { CaseDocumentRevisionService } from "@/server/domain/documents/revision-service";
import { PrismaClientCaseRepository } from "@/server/repositories/prisma/client-case-repository";
import { PrismaCaseDocumentRepository } from "@/server/repositories/prisma/document-repository";
import { PrismaCaseDocumentRevisionRepository } from "@/server/repositories/prisma/document-revision-repository";

export const caseDocumentRevisionService = new CaseDocumentRevisionService(
  new ClientCaseService(new PrismaClientCaseRepository()),
  new PrismaCaseDocumentRepository(),
  new PrismaCaseDocumentRevisionRepository(),
);
