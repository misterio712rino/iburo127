import type { AuthenticatedActor } from "@/server/domain/client-cases/contracts";
import { ClientCaseService } from "@/server/domain/client-cases/service";
import type {
  PracticumProgressRecord,
  PracticumProgressRepository,
} from "@/server/domain/practicum/contracts";

export const PRACTICUM_FORBIDDEN = "PRACTICUM_FORBIDDEN";
export const PRACTICUM_CASE_NOT_FOUND = "PRACTICUM_CASE_NOT_FOUND";
export const PRACTICUM_INVALID_LESSON = "PRACTICUM_INVALID_LESSON";

export type PracticumDefinition = {
  lessonIds: readonly string[];
  lessonIdSet: ReadonlySet<string>;
};

export class PracticumService {
  constructor(
    private readonly cases: ClientCaseService,
    private readonly repository: PracticumProgressRepository,
    private readonly definition: PracticumDefinition,
  ) {}

  private async requireAccessibleCase(actor: AuthenticatedActor, clientCaseId: string) {
    const clientCase = await this.cases.getCase(actor, { caseId: clientCaseId });
    if (!clientCase) throw new Error(PRACTICUM_CASE_NOT_FOUND);
    return clientCase;
  }

  private async requireClientEditor(actor: AuthenticatedActor, clientCaseId: string) {
    const clientCase = await this.requireAccessibleCase(actor, clientCaseId);
    if (!actor.roles.includes("CLIENT") || clientCase.clientId !== actor.userId) {
      throw new Error(PRACTICUM_FORBIDDEN);
    }
    return clientCase;
  }

  async get(actor: AuthenticatedActor, clientCaseId: string): Promise<PracticumProgressRecord | null> {
    await this.requireAccessibleCase(actor, clientCaseId);
    return this.repository.getByClientCaseId(clientCaseId);
  }

  async getOrCreateForClient(actor: AuthenticatedActor, clientCaseId: string) {
    await this.requireClientEditor(actor, clientCaseId);
    const existing = await this.repository.getByClientCaseId(clientCaseId);
    return existing ?? this.repository.createForCase(clientCaseId);
  }

  async completeLesson(
    actor: AuthenticatedActor,
    input: { clientCaseId: string; lessonId: string; expectedVersion: number },
  ) {
    await this.requireClientEditor(actor, input.clientCaseId);
    if (!this.definition.lessonIdSet.has(input.lessonId)) {
      throw new Error(PRACTICUM_INVALID_LESSON);
    }

    const finalLessonId = this.definition.lessonIds.at(-1);
    return this.repository.completeLesson({
      ...input,
      isFinalLesson: input.lessonId === finalLessonId,
    });
  }
}
