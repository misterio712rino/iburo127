import type { AuthenticatedActor } from "@/server/domain/client-cases/contracts";
import type { ClientCaseService } from "@/server/domain/client-cases/service";
import {
  AI_ACCESS_DENIED,
  AI_ASSISTANT_FEATURE_CODE,
  AI_CASE_NOT_FOUND,
  AI_FEATURE_NOT_AVAILABLE,
  type AiAssistantCaseState,
  type AiAssistantReply,
  type AiCaseContext,
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

  private async requireClientCaseContext(
    actor: AuthenticatedActor,
    clientCaseId: string,
  ) {
    if (!actor.roles.includes("CLIENT")) throw new Error(AI_ACCESS_DENIED);

    const clientCase = await this.clientCaseService.getCase(actor, { caseId: clientCaseId });
    if (!clientCase || clientCase.clientId !== actor.userId) {
      throw new Error(AI_CASE_NOT_FOUND);
    }

    const context = await this.contextRepository.loadCaseContext(clientCase.id);
    if (!context) throw new Error(AI_CASE_NOT_FOUND);
    return { clientCase, context };
  }

  async describe(
    actor: AuthenticatedActor,
    clientCaseId: string,
  ): Promise<AiAssistantCaseState> {
    const { clientCase, context } = await this.requireClientCaseContext(actor, clientCaseId);
    return {
      caseId: clientCase.id,
      caseNumber: clientCase.caseNumber,
      planCode: context.planCode,
      stageCode: context.stageCode,
      caseStatus: context.caseStatus,
      enabled: context.featureCodes.includes(AI_ASSISTANT_FEATURE_CODE),
      questionnaireStatus: context.questionnaireStatus,
      questionnaireCompletedSections: context.questionnaireCompletedSections,
      practicumStatus: context.practicumStatus,
      practicumCompletedLessons: context.practicumCompletedLessons,
      documents: context.documents,
      taskSummary: context.taskSummary,
      readyFileCount: context.readyFileCount,
    };
  }

  async reply(
    actor: AuthenticatedActor,
    clientCaseId: string,
    requestBody: unknown,
  ): Promise<AiAssistantReply> {
    const request = parseAiReplyRequest(requestBody);
    const { context } = await this.requireClientCaseContext(actor, clientCaseId);
    if (!context.featureCodes.includes(AI_ASSISTANT_FEATURE_CODE)) {
      throw new Error(AI_FEATURE_NOT_AVAILABLE);
    }

    if (isDirectRestrictedLegalActionRequest(request.message)) {
      return { content: RESTRICTED_LEGAL_ACTION_REPLY, restrictedAction: true };
    }

    const response = await this.modelGateway.reply({
      instructions: buildAiInstructions(context as AiCaseContext),
      messages: [...request.history, { role: "user", content: request.message }],
    });

    const content = sanitizeAiModelReply(response);
    return {
      content,
      restrictedAction: content === RESTRICTED_LEGAL_ACTION_REPLY,
    };
  }
}
