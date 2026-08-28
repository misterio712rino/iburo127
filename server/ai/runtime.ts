import "server-only";

import { readOpenAiRuntimeConfig } from "@/server/config/production";
import { AiAssistantService } from "@/server/domain/ai/service";
import { clientCaseService } from "@/server/client-cases/runtime";
import { OpenAiResponsesGateway } from "@/server/ai/openai-responses-core";
import { PrismaAiCaseContextRepository } from "@/server/repositories/prisma/ai-case-context-repository";

let service: AiAssistantService | undefined;

export function getAiAssistantService(): AiAssistantService {
  service ??= new AiAssistantService(
    clientCaseService,
    new PrismaAiCaseContextRepository(),
    new OpenAiResponsesGateway(readOpenAiRuntimeConfig()),
  );
  return service;
}
