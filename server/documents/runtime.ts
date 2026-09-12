import "server-only";

import { DOCUMENT_DEFINITIONS } from "@/lib/platform/document-definitions";
import { ClientCaseService } from "@/server/domain/client-cases/service";
import {
  CaseDocumentService,
  type DocumentDefinitionRegistry,
} from "@/server/domain/documents/service";
import { questionnaireService } from "@/server/questionnaire/runtime";
import { PrismaClientCaseRepository } from "@/server/repositories/prisma/client-case-repository";
import { PrismaCaseDocumentRepository } from "@/server/repositories/prisma/document-repository";

const definitions: DocumentDefinitionRegistry = new Map(
  DOCUMENT_DEFINITIONS.map((definition) => [
    definition.id,
    { code: definition.id, requiredFieldIds: definition.requiredFieldIds },
  ]),
);

export const caseDocumentService = new CaseDocumentService(
  new ClientCaseService(new PrismaClientCaseRepository()),
  questionnaireService,
  new PrismaCaseDocumentRepository(),
  definitions,
);
