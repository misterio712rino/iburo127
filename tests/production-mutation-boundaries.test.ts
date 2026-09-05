import assert from "node:assert/strict";
import type {
  AuthenticatedActor,
  ClientCaseAccessScope,
  ClientCaseRecord,
  ClientCaseRepository,
} from "@/server/domain/client-cases/contracts";
import { ClientCaseService } from "@/server/domain/client-cases/service";
import type {
  QuestionnaireRecord,
  QuestionnaireRepository,
  SaveQuestionnaireAnswerInput,
  CompleteQuestionnaireSectionInput,
  CompleteQuestionnaireInput,
} from "@/server/domain/questionnaire/contracts";
import { createQuestionnaireDefinition } from "@/server/domain/questionnaire/definition";
import { QuestionnaireService } from "@/server/domain/questionnaire/service";
import type {
  PracticumProgressRecord,
  PracticumProgressRepository,
} from "@/server/domain/practicum/contracts";
import { PracticumService } from "@/server/domain/practicum/service";
import type { QuestionnaireSection } from "@/lib/platform/types";

const now = new Date("2026-08-28T00:00:00.000Z");

const clientCase: ClientCaseRecord = {
  id: "case-client",
  caseNumber: "IBR-2026-STAGING-CLIENT",
  clientId: "client-1",
  planCode: "PRO",
  stageCode: "PREPARATION",
  assignedLawyerId: "lawyer-1",
  status: "ACTIVE",
};

const actors: Record<"client" | "lawyer" | "manager" | "otherClient", AuthenticatedActor> = {
  client: { userId: "client-1", roles: ["CLIENT"] },
  lawyer: { userId: "lawyer-1", roles: ["LAWYER"] },
  manager: { userId: "manager-1", roles: ["MANAGER"] },
  otherClient: { userId: "client-2", roles: ["CLIENT"] },
};

class ScopedCaseRepository implements ClientCaseRepository {
  async findAccessibleCase(scope: ClientCaseAccessScope) {
    if (scope.caseId && scope.caseId !== clientCase.id) return null;
    if (scope.caseNumber && scope.caseNumber !== clientCase.caseNumber) return null;
    if (scope.actor.roles.includes("MANAGER")) return clientCase;
    if (scope.actor.roles.includes("CLIENT") && scope.actor.userId === clientCase.clientId) return clientCase;
    if (scope.actor.roles.includes("LAWYER") && scope.actor.userId === clientCase.assignedLawyerId) return clientCase;
    return null;
  }

  async listAccessibleCases(actor: AuthenticatedActor) {
    return (await this.findAccessibleCase({ actor, caseId: clientCase.id })) ? [clientCase] : [];
  }
}

class InMemoryQuestionnaireRepository implements QuestionnaireRepository {
  current: QuestionnaireRecord | null = null;

  async getByClientCaseId(clientCaseId: string) {
    return this.current?.clientCaseId === clientCaseId ? this.current : null;
  }

  async createForCase(clientCaseId: string, schemaVersion: number) {
    this.current = {
      clientCaseId,
      schemaVersion,
      status: "NOT_STARTED",
      answers: {},
      completedSectionIds: [],
      startedAt: null,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
      version: 1,
    };
    return this.current;
  }

  async saveAnswer(input: SaveQuestionnaireAnswerInput) {
    assert.equal(this.current?.version, input.expectedVersion);
    this.current = {
      ...this.current!,
      status: "IN_PROGRESS",
      answers: { ...this.current!.answers, [input.fieldId]: input.value },
      completedSectionIds: this.current!.completedSectionIds.filter(
        (sectionId) => !input.invalidatedSectionIds?.includes(sectionId),
      ),
      startedAt: this.current!.startedAt ?? now,
      version: this.current!.version + 1,
      updatedAt: now,
    };
    return this.current;
  }

  async completeSection(input: CompleteQuestionnaireSectionInput) {
    assert.equal(this.current?.version, input.expectedVersion);
    this.current = {
      ...this.current!,
      completedSectionIds: [...new Set([...this.current!.completedSectionIds, input.sectionId])],
      version: this.current!.version + 1,
      updatedAt: now,
    };
    return this.current;
  }

  async markCompleted(input: CompleteQuestionnaireInput) {
    assert.equal(this.current?.version, input.expectedVersion);
    this.current = {
      ...this.current!,
      status: "COMPLETED",
      completedAt: now,
      version: this.current!.version + 1,
      updatedAt: now,
    };
    return this.current;
  }
}

class InMemoryPracticumRepository implements PracticumProgressRepository {
  current: PracticumProgressRecord | null = null;

  async getByClientCaseId(clientCaseId: string) {
    return this.current?.clientCaseId === clientCaseId ? this.current : null;
  }

  async createForCase(clientCaseId: string) {
    this.current = {
      clientCaseId,
      completedLessonIds: [],
      startedAt: null,
      completedAt: null,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    return this.current;
  }

  async completeLesson(input: {
    clientCaseId: string;
    lessonId: string;
    expectedVersion: number;
    isFinalLesson?: boolean;
  }) {
    assert.equal(this.current?.version, input.expectedVersion);
    this.current = {
      ...this.current!,
      completedLessonIds: [...new Set([...this.current!.completedLessonIds, input.lessonId])],
      startedAt: this.current!.startedAt ?? now,
      completedAt: input.isFinalLesson ? now : this.current!.completedAt,
      version: this.current!.version + 1,
      updatedAt: now,
    };
    return this.current;
  }
}

const sections = [
  {
    id: "personal",
    number: 1,
    title: "Personal",
    description: "",
    fields: [{ id: "name", label: "Name", type: "text", required: true }],
  },
] satisfies QuestionnaireSection[];

async function testQuestionnaireMutationBoundaries() {
  const cases = new ClientCaseService(new ScopedCaseRepository());
  const repository = new InMemoryQuestionnaireRepository();
  const service = new QuestionnaireService(cases, repository, createQuestionnaireDefinition(sections, 1));

  await assert.rejects(
    service.getOrCreateForClient(actors.lawyer, clientCase.id),
    /QUESTIONNAIRE_FORBIDDEN/,
  );
  await assert.rejects(
    service.getOrCreateForClient(actors.manager, clientCase.id),
    /QUESTIONNAIRE_FORBIDDEN/,
  );
  await assert.rejects(
    service.getOrCreateForClient(actors.otherClient, clientCase.id),
    /QUESTIONNAIRE_CASE_NOT_FOUND/,
  );

  const created = await service.getOrCreateForClient(actors.client, clientCase.id);
  assert.equal(created.version, 1);

  const updated = await service.saveAnswer(actors.client, {
    clientCaseId: clientCase.id,
    fieldId: "name",
    value: "Staging Client",
    expectedVersion: 1,
  });
  assert.equal(updated.version, 2);
  assert.equal(updated.answers.name, "Staging Client");

  await assert.rejects(
    service.saveAnswer(actors.lawyer, {
      clientCaseId: clientCase.id,
      fieldId: "name",
      value: "Illegal edit",
      expectedVersion: 2,
    }),
    /QUESTIONNAIRE_FORBIDDEN/,
  );
}

async function testPracticumMutationBoundaries() {
  const cases = new ClientCaseService(new ScopedCaseRepository());
  const repository = new InMemoryPracticumRepository();
  const service = new PracticumService(cases, repository, {
    lessonIds: ["lesson-1", "lesson-2"],
    lessonIdSet: new Set(["lesson-1", "lesson-2"]),
  });

  await assert.rejects(service.getOrCreateForClient(actors.lawyer, clientCase.id), /PRACTICUM_FORBIDDEN/);
  await assert.rejects(service.getOrCreateForClient(actors.manager, clientCase.id), /PRACTICUM_FORBIDDEN/);
  await assert.rejects(
    service.getOrCreateForClient(actors.otherClient, clientCase.id),
    /PRACTICUM_CASE_NOT_FOUND/,
  );

  const created = await service.getOrCreateForClient(actors.client, clientCase.id);
  assert.equal(created.version, 1);

  const progressed = await service.completeLesson(actors.client, {
    clientCaseId: clientCase.id,
    lessonId: "lesson-1",
    expectedVersion: 1,
  });
  assert.equal(progressed.version, 2);
  assert.deepEqual(progressed.completedLessonIds, ["lesson-1"]);

  await assert.rejects(
    service.completeLesson(actors.manager, {
      clientCaseId: clientCase.id,
      lessonId: "lesson-2",
      expectedVersion: 2,
    }),
    /PRACTICUM_FORBIDDEN/,
  );
}

await testQuestionnaireMutationBoundaries();
await testPracticumMutationBoundaries();

console.log("PRODUCTION_MUTATION_BOUNDARIES_PASS");
