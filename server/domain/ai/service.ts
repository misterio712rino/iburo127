import type { AuthenticatedActor } from "@/server/domain/client-cases/contracts";
import type { ClientCaseService } from "@/server/domain/client-cases/service";
import {
  AI_ACCESS_DENIED,
  AI_ASSISTANT_FEATURE_CODE,
  AI_CASE_NOT_FOUND,
  AI_FEATURE_NOT_AVAILABLE,
  type AiAssistantReply,
  type AiCaseContextRepository,
  type AiModelGateway,
} from "./contracts";
import {
  buildAiInstructions,
  isDirectRestrictedLegalActionRequest,
  parseAiReplyRequest,
  RESTRICTED_LEGAL_ACTION_REPLY,
  sanitizeAiModelReply,
} from "./policy";

export class AiAssistantService {
  constructor(
    private readonly clientCaseService: ClientCaseService,
    private readonly contextRepository: AiCaseContextRepository,
    private readonly modelGateway: AiModelGateway,
  ) {}

  async reply(
    actor: AuthenticatedActor,
    clientCaseId: string,
    requestBody: unknown,
  ): Promise<AiAssistantReply> {
    if (!actor.roles.includes("CLIENT")) throw new Error(AI_ACCESS_DENIED);

    const request = parseAiReplyRequest(requestBody);
    const clientCase = await this.clientCaseService.getCase(actor, { caseId: clientCaseId });
    if (!clientCase || clientCase.clientId !== actor.userId) {
      throw new Error(AI_CASE_NOT_FOUND);
    }

    const context = await this.contextRepository.loadCaseContext(clientCase.id);
    if (!context) throw new Error(AI_CASE_NOT_FOUND);
    if (!context.featureCodes.includes(AI_ASSISTANT_FEATURE_CODE)) {
      throw new Error(AI_FEATURE_NOT_AVAILABLE);
    }

    if (isDirectRestrictedLegalActionRequest(request.message)) {
      return { content: RESTRICTED_LEGAL_ACTION_REPLY, restrictedAction: true };
    }

    const response = await this.modelGateway.reply({
      instructions: buildAiInstructions(context),
      messages: [...request.history, { role: "user", content: request.message }],
    });

    const content = sanitizeAiModelReply(response);
    return {
      content,
      restrictedAction: content === RESTRICTED_LEGAL_ACTION_REPLY,
    };
  }
}
