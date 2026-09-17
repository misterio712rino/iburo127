import "server-only";

import { ClientCaseService } from "@/server/domain/client-cases/service";
import { CaseDocumentRevisionService } from "@/server/domain/documents/revision-service";
import { EmptyDocumentTemplateRegistry } from "@/server/domain/documents/template-contracts";
import { PrismaClientCaseRepository } from "@/server/repositories/prisma/client-case-repository";
import { PrismaCaseDocumentRepository } from "@/server/repositories/prisma/document-repository";
import { PrismaCaseDocumentRevisionRepository } from "@/server/repositories/prisma/document-revision-repository";
import { PrismaQuestionnaireRepository } from "@/server/repositories/prisma/questionnaire-repository";

export const caseDocumentRevisionService = new CaseDocumentRevisionService(
  new ClientCaseService(new PrismaClientCaseRepository()),
  new PrismaCaseDocumentRepository(),
  new PrismaCaseDocumentRevisionRepository(),
  new EmptyDocumentTemplateRegistry(),
  new PrismaQuestionnaireRepository(),
);
