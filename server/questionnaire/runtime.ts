import "server-only";

import { QUESTIONNAIRE_SECTIONS } from "@/lib/platform/questionnaire-content";
import { ClientCaseService } from "@/server/domain/client-cases/service";
import { createQuestionnaireDefinition } from "@/server/domain/questionnaire/definition";
import { QuestionnaireService } from "@/server/domain/questionnaire/service";
import { PrismaClientCaseRepository } from "@/server/repositories/prisma/client-case-repository";
import { PrismaQuestionnaireRepository } from "@/server/repositories/prisma/questionnaire-repository";

const CURRENT_QUESTIONNAIRE_SCHEMA_VERSION = 1;

const clientCaseRepository = new PrismaClientCaseRepository();
const questionnaireRepository = new PrismaQuestionnaireRepository();
const clientCaseService = new ClientCaseService(clientCaseRepository);
const questionnaireDefinition = createQuestionnaireDefinition(
  QUESTIONNAIRE_SECTIONS,
  CURRENT_QUESTIONNAIRE_SCHEMA_VERSION,
);

export const questionnaireService = new QuestionnaireService(
  clientCaseService,
  questionnaireRepository,
  questionnaireDefinition,
);

export { CURRENT_QUESTIONNAIRE_SCHEMA_VERSION };
