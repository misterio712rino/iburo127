import "server-only";

import { readOpenAiRuntimeConfig } from "@/server/config/production";
import type { AiModelGateway, AiModelInput } from "@/server/domain/ai/contracts";
import { AiAssistantService } from "@/server/domain/ai/service";
import { clientCaseService } from "@/server/client-cases/runtime";
import { OpenAiResponsesGateway } from "@/server/ai/openai-responses-core";
import {
  readAiProviderName,
  readYandexGptRuntimeConfig,
} from "@/server/ai/provider-config-core";
import { YandexGptGateway } from "@/server/ai/yandex-gpt-core";
import { readAiUsageRuntimeConfig } from "@/server/ai/usage-config";
import { PrismaAiCaseContextRepository } from "@/server/repositories/prisma/ai-case-context-repository";
import { PrismaAiUsageLedger } from "@/server/repositories/prisma/ai-usage-ledger";

let providerGateway: AiModelGateway | undefined;

function createProviderGateway(): AiModelGateway {
  const provider = readAiProviderName();
  if (provider === "yandex") {
    return new YandexGptGateway(readYandexGptRuntimeConfig());
  }
  return new OpenAiResponsesGateway(readOpenAiRuntimeConfig());
}

const lazyProviderGateway: AiModelGateway = {
  async reply(input: AiModelInput) {
    providerGateway ??= createProviderGateway();
    return providerGateway.reply(input);
  },
};

let service: AiAssistantService | undefined;

export function getAiAssistantService(): AiAssistantService {
  service ??= new AiAssistantService(
    clientCaseService,
    new PrismaAiCaseContextRepository(),
    lazyProviderGateway,
    new PrismaAiUsageLedger(readAiUsageRuntimeConfig()),
  );
  return service;
}
