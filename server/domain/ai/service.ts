import type { AuthenticatedActor } from "@/server/domain/client-cases/contracts";
import type { ClientCaseService } from "@/server/domain/client-cases/service";
import {
  AI_ACCESS_DENIED,
  AI_ASSISTANT_FEATURE_CODE,
  AI_CASE_NOT_FOUND,
  AI_FEATURE_NOT_AVAILABLE,
  AI_RATE_LIMITED,
  type AiAssistantCaseState,
  type AiAssistantReply,
  type AiAuditOutcome,
  type AiCaseContextRepository,
  type AiModelGateway,
  type AiUsageLedger,
} from "./contracts";
import {
  AI_POLICY_BOUNDARY_REPLY,
  AI_SENSITIVE_DATA_REPLY,
  buildAiInstructions,
  buildAiSafetyIdentifier,
  buildUntrustedHistoryContext,
  containsSensitivePersonalData,
  isDirectRestrictedLegalActionRequest,
  isPromptInjectionAttempt,
  isRestrictedAiReply,
  parseAiReplyRequest,
  RESTRICTED_LEGAL_ACTION_REPLY,
  sanitizeAiModelReply,
} from "./policy";

export class AiAssistantService {
  constructor(
    private readonly clientCaseService: ClientCaseService,
    private readonly contextRepository: AiCaseContextRepository,
    private readonly modelGateway: AiModelGateway,
    private readonly usageLedger: AiUsageLedger,
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

  private async recordOutcomeBestEffort(input: {
    clientCaseId: string;
    actorUserId: string;
    outcome: AiAuditOutcome;
  }): Promise<void> {
    try {
      await this.usageLedger.recordOutcome(input);
    } catch {
      // The durable reservation was already written before any provider call.
      // A missing secondary outcome is an operational audit anomaly, but must
      // not convert an already-produced provider response into a retriable 503.
    }
  }

  private async restrictedReply(input: {
    clientCaseId: string;
    actorUserId: string;
    content: string;
  }): Promise<AiAssistantReply> {
    await this.recordOutcomeBestEffort({
      clientCaseId: input.clientCaseId,
      actorUserId: input.actorUserId,
      outcome: "restricted",
    });
    return { content: input.content, restrictedAction: true };
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
    const { clientCase, context } = await this.requireClientCaseContext(actor, clientCaseId);
    if (!context.featureCodes.includes(AI_ASSISTANT_FEATURE_CODE)) {
      throw new Error(AI_FEATURE_NOT_AVAILABLE);
    }

    const reserved = await this.usageLedger.reserveRequest({
      clientCaseId: clientCase.id,
      actorUserId: actor.userId,
      now: new Date(),
    });
    if (!reserved) throw new Error(AI_RATE_LIMITED);

    if (containsSensitivePersonalData(request.message)) {
      return this.restrictedReply({
        clientCaseId: clientCase.id,
        actorUserId: actor.userId,
        content: AI_SENSITIVE_DATA_REPLY,
      });
    }

    if (isPromptInjectionAttempt(request.message)) {
      return this.restrictedReply({
        clientCaseId: clientCase.id,
        actorUserId: actor.userId,
        content: AI_POLICY_BOUNDARY_REPLY,
      });
    }

    if (isDirectRestrictedLegalActionRequest(request.message)) {
      return this.restrictedReply({
        clientCaseId: clientCase.id,
        actorUserId: actor.userId,
        content: RESTRICTED_LEGAL_ACTION_REPLY,
      });
    }

    let response: string;
    try {
      const untrustedHistory = buildUntrustedHistoryContext(request.history);
      response = await this.modelGateway.reply({
        instructions: buildAiInstructions(context),
        messages: [
          ...(untrustedHistory ? [{ role: "user" as const, content: untrustedHistory }] : []),
          { role: "user", content: request.message },
        ],
        safetyIdentifier: buildAiSafetyIdentifier(actor.userId),
      });
    } catch (error) {
      await this.recordOutcomeBestEffort({
        clientCaseId: clientCase.id,
        actorUserId: actor.userId,
        outcome: "failed",
      });
      throw error;
    }

    let content: string;
    try {
      content = sanitizeAiModelReply(response);
    } catch (error) {
      await this.recordOutcomeBestEffort({
        clientCaseId: clientCase.id,
        actorUserId: actor.userId,
        outcome: "failed",
      });
      throw error;
    }

    const restrictedAction = isRestrictedAiReply(content);
    await this.recordOutcomeBestEffort({
      clientCaseId: clientCase.id,
      actorUserId: actor.userId,
      outcome: restrictedAction ? "restricted" : "completed",
    });
    return { content, restrictedAction };
  }
}
