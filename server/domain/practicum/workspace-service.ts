import type { AuthenticatedActor } from "@/server/domain/client-cases/contracts";
import { ClientCaseService } from "@/server/domain/client-cases/service";
import {
  PRACTICUM_WORKSPACE_FORBIDDEN,
  PRACTICUM_WORKSPACE_INVALID_HOMEWORK,
  PRACTICUM_WORKSPACE_INVALID_LESSON,
  PRACTICUM_WORKSPACE_INVALID_MESSAGE,
  PRACTICUM_WORKSPACE_LAWYER_NOT_ASSIGNED,
  PRACTICUM_WORKSPACE_NOT_FOUND,
  type PracticumHomeworkReviewDecision,
  type PracticumWorkspaceRepository,
} from "@/server/domain/practicum/workspace-contracts";

const MAX_HOMEWORK_LENGTH = 20_000;
const MAX_MESSAGE_LENGTH = 4_000;
const MAX_REVIEW_COMMENT_LENGTH = 8_000;

export type PracticumWorkspaceDefinition = {
  lessonIdSet: ReadonlySet<string>;
};

function normalizeBoundedText(
  value: unknown,
  maxLength: number,
  errorCode: string,
  options: { allowEmpty?: boolean } = {},
) {
  if (typeof value !== "string") throw new Error(errorCode);
  const text = value.trim();
  if ((!options.allowEmpty && text.length === 0) || text.length > maxLength) {
    throw new Error(errorCode);
  }
  return text;
}

export class PracticumWorkspaceService {
  constructor(
    private readonly cases: ClientCaseService,
    private readonly repository: PracticumWorkspaceRepository,
    private readonly definition: PracticumWorkspaceDefinition,
  ) {}

  private requireKnownLesson(lessonId: string) {
    if (!this.definition.lessonIdSet.has(lessonId)) {
      throw new Error(PRACTICUM_WORKSPACE_INVALID_LESSON);
    }
  }

  private async requireAccessibleCase(actor: AuthenticatedActor, clientCaseId: string) {
    const clientCase = await this.cases.getCase(actor, { caseId: clientCaseId });
    if (!clientCase) throw new Error(PRACTICUM_WORKSPACE_NOT_FOUND);
    return clientCase;
  }

  private async requireClientOwner(actor: AuthenticatedActor, clientCaseId: string) {
    const clientCase = await this.requireAccessibleCase(actor, clientCaseId);
    if (!actor.roles.includes("CLIENT") || clientCase.clientId !== actor.userId) {
      throw new Error(PRACTICUM_WORKSPACE_FORBIDDEN);
    }
    return clientCase;
  }

  private async requireAssignedLawyer(actor: AuthenticatedActor, clientCaseId: string) {
    const clientCase = await this.requireAccessibleCase(actor, clientCaseId);
    if (
      !actor.roles.includes("LAWYER") ||
      !clientCase.assignedLawyerId ||
      clientCase.assignedLawyerId !== actor.userId
    ) {
      throw new Error(PRACTICUM_WORKSPACE_FORBIDDEN);
    }
    return clientCase;
  }

  async getLessonWorkspace(
    actor: AuthenticatedActor,
    input: { clientCaseId: string; lessonId: string },
  ) {
    this.requireKnownLesson(input.lessonId);
    await this.requireAccessibleCase(actor, input.clientCaseId);
    return this.repository.getLessonWorkspace(input);
  }

  async saveHomeworkDraft(
    actor: AuthenticatedActor,
    input: { clientCaseId: string; lessonId: string; answerText: unknown },
  ) {
    this.requireKnownLesson(input.lessonId);
    await this.requireClientOwner(actor, input.clientCaseId);
    const answerText = normalizeBoundedText(
      input.answerText,
      MAX_HOMEWORK_LENGTH,
      PRACTICUM_WORKSPACE_INVALID_HOMEWORK,
      { allowEmpty: true },
    );
    return this.repository.saveHomeworkDraft({
      clientCaseId: input.clientCaseId,
      lessonId: input.lessonId,
      answerText,
      actorUserId: actor.userId,
    });
  }

  async submitHomework(
    actor: AuthenticatedActor,
    input: { clientCaseId: string; lessonId: string; answerText: unknown },
  ) {
    this.requireKnownLesson(input.lessonId);
    await this.requireClientOwner(actor, input.clientCaseId);
    const answerText = normalizeBoundedText(
      input.answerText,
      MAX_HOMEWORK_LENGTH,
      PRACTICUM_WORKSPACE_INVALID_HOMEWORK,
    );
    return this.repository.submitHomework({
      clientCaseId: input.clientCaseId,
      lessonId: input.lessonId,
      answerText,
      actorUserId: actor.userId,
    });
  }

  async reviewHomework(
    actor: AuthenticatedActor,
    input: {
      clientCaseId: string;
      lessonId: string;
      decision: PracticumHomeworkReviewDecision;
      comment: unknown;
    },
  ) {
    this.requireKnownLesson(input.lessonId);
    await this.requireAssignedLawyer(actor, input.clientCaseId);
    if (input.decision !== "CHANGES_REQUESTED" && input.decision !== "ACCEPTED") {
      throw new Error(PRACTICUM_WORKSPACE_INVALID_HOMEWORK);
    }
    const comment = normalizeBoundedText(
      input.comment,
      MAX_REVIEW_COMMENT_LENGTH,
      PRACTICUM_WORKSPACE_INVALID_HOMEWORK,
      { allowEmpty: input.decision === "ACCEPTED" },
    );
    return this.repository.reviewHomework({
      clientCaseId: input.clientCaseId,
      lessonId: input.lessonId,
      decision: input.decision,
      comment,
      actorUserId: actor.userId,
    });
  }

  async sendLessonMessage(
    actor: AuthenticatedActor,
    input: { clientCaseId: string; lessonId: string; body: unknown },
  ) {
    this.requireKnownLesson(input.lessonId);
    const clientCase = await this.requireAccessibleCase(actor, input.clientCaseId);

    const isClient = actor.roles.includes("CLIENT") && clientCase.clientId === actor.userId;
    const isAssignedLawyer =
      actor.roles.includes("LAWYER") && clientCase.assignedLawyerId === actor.userId;

    if (!isClient && !isAssignedLawyer) {
      throw new Error(PRACTICUM_WORKSPACE_FORBIDDEN);
    }
    if (isClient && !clientCase.assignedLawyerId) {
      throw new Error(PRACTICUM_WORKSPACE_LAWYER_NOT_ASSIGNED);
    }

    const body = normalizeBoundedText(
      input.body,
      MAX_MESSAGE_LENGTH,
      PRACTICUM_WORKSPACE_INVALID_MESSAGE,
    );
    return this.repository.addLessonMessage({
      clientCaseId: input.clientCaseId,
      lessonId: input.lessonId,
      body,
      actorUserId: actor.userId,
    });
  }
}
