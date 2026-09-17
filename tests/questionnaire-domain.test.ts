import assert from "node:assert/strict";
import { ClientCaseService } from "@/server/domain/client-cases/service";
import type {
  AuthenticatedActor,
  ClientCaseAccessScope,
  ClientCaseRecord,
  ClientCaseRepository,
} from "@/server/domain/client-cases/contracts";
import type {
  CompleteQuestionnaireInput,
  CompleteQuestionnaireSectionInput,
  QuestionnaireRecord,
  QuestionnaireRepository,
  SaveQuestionnaireAnswerInput,
} from "@/server/domain/questionnaire/contracts";
import { createQuestionnaireDefinition } from "@/server/domain/questionnaire/definition";
import { QuestionnaireService } from "@/server/domain/questionnaire/service";
import { QUESTIONNAIRE_SECTIONS, isQuestionnaireFieldVisible } from "@/lib/platform/questionnaire-content";
import type { QuestionnaireSection } from "@/lib/platform/types";

const now = new Date("2026-08-28T00:00:00.000Z");
const clientCase: ClientCaseRecord = {
  id: "case-questionnaire",
  caseNumber: "IBR-2026-000777",
  clientId: "client-questionnaire",
  planCode: "PRO",
  stageCode: "PREPARATION",
  assignedLawyerId: "lawyer-questionnaire",
  status: "ACTIVE",
};

const client: AuthenticatedActor = {
  userId: clientCase.clientId,
  roles: ["CLIENT"],
};

class InMemoryCaseRepository implements ClientCaseRepository {
  async findAccessibleCase(scope: ClientCaseAccessScope) {
    if (scope.caseId && scope.caseId !== clientCase.id) return null;
    if (scope.caseNumber && scope.caseNumber !== clientCase.caseNumber) return null;
    return clientCase;
  }

  async listAccessibleCases() {
    return [clientCase];
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
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    return this.current;
  }

  private assertVersion(expectedVersion: number) {
    assert.ok(this.current);
    if (expectedVersion !== this.current.version) throw new Error("QUESTIONNAIRE_VERSION_CONFLICT");
  }

  async saveAnswer(input: SaveQuestionnaireAnswerInput) {
    this.assertVersion(input.expectedVersion);
    const invalidated = new Set(input.invalidatedSectionIds ?? []);
    this.current = {
      ...this.current!,
      status: "IN_PROGRESS",
      answers: { ...this.current!.answers, [input.fieldId]: input.value },
      completedSectionIds: this.current!.completedSectionIds.filter((id) => !invalidated.has(id)),
      startedAt: this.current!.startedAt ?? now,
      version: this.current!.version + 1,
      updatedAt: now,
    };
    return this.current;
  }

  async completeSection(input: CompleteQuestionnaireSectionInput) {
    this.assertVersion(input.expectedVersion);
    const completedSectionIds = this.current!.completedSectionIds.includes(input.sectionId)
      ? [...this.current!.completedSectionIds]
      : [...this.current!.completedSectionIds, input.sectionId];
    this.current = {
      ...this.current!,
      status: "IN_PROGRESS",
      completedSectionIds,
      startedAt: this.current!.startedAt ?? now,
      version: this.current!.version + 1,
      updatedAt: now,
    };
    return this.current;
  }

  async markCompleted(input: CompleteQuestionnaireInput) {
    this.assertVersion(input.expectedVersion);
    this.current = {
      ...this.current!,
      status: "COMPLETED",
      completedSectionIds: [...new Set([...this.current!.completedSectionIds, ...input.reviewSectionIds])],
      completedAt: now,
      version: this.current!.version + 1,
      updatedAt: now,
    };
    return this.current;
  }
}

const sections = [
  {
    id: "basics",
    number: 1,
    title: "Basics",
    description: "",
    fields: [
      { id: "name", label: "Name", type: "text", required: true },
      { id: "income", label: "Income", type: "currency", required: true },
      { id: "employed", label: "Employed", type: "yes-no", required: true },
      {
        id: "employmentType",
        label: "Employment type",
        type: "select",
        required: true,
        options: ["employee", "self-employed"],
        visibleWhen: { fieldId: "employed", equals: true },
      },
    ],
  },
  {
    id: "review",
    number: 2,
    title: "Review",
    description: "",
    fields: [],
    review: true,
  },
] satisfies QuestionnaireSection[];

function createTestService(repository: InMemoryQuestionnaireRepository) {
  return new QuestionnaireService(
    new ClientCaseService(new InMemoryCaseRepository()),
    repository,
    createQuestionnaireDefinition(sections, 1),
  );
}

async function run() {
  const repository = new InMemoryQuestionnaireRepository();
  const service = createTestService(repository);

  const created = await service.getOrCreateForClient(client, clientCase.id);
  assert.equal(created.version, 1);

  await assert.rejects(
    service.completeSection(client, {
      clientCaseId: clientCase.id,
      sectionId: "basics",
      expectedVersion: 1,
    }),
    /QUESTIONNAIRE_INCOMPLETE_SECTION/,
  );

  await assert.rejects(
    service.saveAnswer(client, {
      clientCaseId: clientCase.id,
      fieldId: "income",
      value: -1,
      expectedVersion: 1,
    }),
    /QUESTIONNAIRE_INVALID_FIELD/,
  );

  let current = await service.saveAnswer(client, {
    clientCaseId: clientCase.id,
    fieldId: "name",
    value: "Иван Иванов",
    expectedVersion: 1,
  });
  current = await service.saveAnswer(client, {
    clientCaseId: clientCase.id,
    fieldId: "income",
    value: 75000,
    expectedVersion: current.version,
  });
  current = await service.saveAnswer(client, {
    clientCaseId: clientCase.id,
    fieldId: "employed",
    value: false,
    expectedVersion: current.version,
  });

  current = await service.completeSection(client, {
    clientCaseId: clientCase.id,
    sectionId: "basics",
    expectedVersion: current.version,
  });
  assert.deepEqual(current.completedSectionIds, ["basics"]);

  current = await service.saveAnswer(client, {
    clientCaseId: clientCase.id,
    fieldId: "employed",
    value: true,
    expectedVersion: current.version,
  });

  await assert.rejects(
    service.markCompleted(client, {
      clientCaseId: clientCase.id,
      expectedVersion: current.version,
    }),
    /QUESTIONNAIRE_INCOMPLETE/,
  );

  current = await service.saveAnswer(client, {
    clientCaseId: clientCase.id,
    fieldId: "employmentType",
    value: "employee",
    expectedVersion: current.version,
  });

  current = await service.completeSection(client, {
    clientCaseId: clientCase.id,
    sectionId: "basics",
    expectedVersion: current.version,
  });
  const beforeFinalVersion = current.version;

  // The final UI action is a single POST /complete: no separate review POST.
  const completed = await service.markCompleted(client, {
    clientCaseId: clientCase.id,
    expectedVersion: beforeFinalVersion,
  });
  assert.equal(completed.status, "COMPLETED");
  assert.deepEqual(completed.completedSectionIds, ["basics", "review"]);
  assert.equal(completed.version, beforeFinalVersion + 1);
  assert.equal((await service.get(client, clientCase.id))?.status, "COMPLETED");

  await assert.rejects(
    service.saveAnswer(client, {
      clientCaseId: clientCase.id,
      fieldId: "name",
      value: "Changed",
      expectedVersion: completed.version,
    }),
    /QUESTIONNAIRE_ALREADY_COMPLETED/,
  );
}

async function runVersionConflictAndReviewIdempotence() {
  const service = createTestService(new InMemoryQuestionnaireRepository());
  let current = await service.getOrCreateForClient(client, clientCase.id);
  for (const [fieldId, value] of [
    ["name", "Клиент"],
    ["income", 10000],
    ["employed", false],
  ] as const) {
    current = await service.saveAnswer(client, { clientCaseId: clientCase.id, fieldId, value, expectedVersion: current.version });
  }
  current = await service.completeSection(client, { clientCaseId: clientCase.id, sectionId: "basics", expectedVersion: current.version });
  await assert.rejects(
    service.markCompleted(client, { clientCaseId: clientCase.id, expectedVersion: current.version - 1 }),
    /QUESTIONNAIRE_VERSION_CONFLICT/,
  );
  assert.equal((await service.get(client, clientCase.id))?.status, "IN_PROGRESS");
  current = await service.completeSection(client, { clientCaseId: clientCase.id, sectionId: "review", expectedVersion: current.version });
  const completed = await service.markCompleted(client, { clientCaseId: clientCase.id, expectedVersion: current.version });
  assert.equal(completed.completedSectionIds.filter((id) => id === "review").length, 1);
}

async function runPropertyVisibilityRegression() {
  const realEstate = QUESTIONNAIRE_SECTIONS.find((section) => section.id === "real-estate");
  const mortgage = QUESTIONNAIRE_SECTIONS.find((section) => section.id === "mortgage");
  assert.ok(realEstate);
  assert.ok(mortgage);

  const noPropertyAnswers = { hasRealEstate: false, hasMortgage: true };
  assert.ok(realEstate.fields.every((field) => !isQuestionnaireFieldVisible(field, noPropertyAnswers)));
  assert.ok(mortgage.fields.every((field) => !isQuestionnaireFieldVisible(field, noPropertyAnswers)));
  assert.ok(realEstate.fields.every((field) => isQuestionnaireFieldVisible(field, { hasRealEstate: true })));
  assert.ok(mortgage.fields.every((field) => isQuestionnaireFieldVisible(field, { hasRealEstate: true, hasMortgage: true })));

  const service = new QuestionnaireService(
    new ClientCaseService(new InMemoryCaseRepository()),
    new InMemoryQuestionnaireRepository(),
    createQuestionnaireDefinition(QUESTIONNAIRE_SECTIONS, 1),
  );
  let current = await service.getOrCreateForClient(client, clientCase.id);
  current = await service.saveAnswer(client, { clientCaseId: clientCase.id, fieldId: "hasRealEstate", value: false, expectedVersion: current.version });
  // Existing answers may retain a mortgage=true value after the parent answer changes.
  current = await service.saveAnswer(client, { clientCaseId: clientCase.id, fieldId: "hasMortgage", value: true, expectedVersion: current.version });
  current = await service.completeSection(client, { clientCaseId: clientCase.id, sectionId: "real-estate", expectedVersion: current.version });
  current = await service.completeSection(client, { clientCaseId: clientCase.id, sectionId: "mortgage", expectedVersion: current.version });
  assert.ok(current.completedSectionIds.includes("real-estate"));
  assert.ok(current.completedSectionIds.includes("mortgage"));

  // Changing the parent answer reopens BOTH previously completed dependent
  // sections when a saved mortgage=true now becomes relevant again.
  current = await service.saveAnswer(client, { clientCaseId: clientCase.id, fieldId: "hasRealEstate", value: true, expectedVersion: current.version });
  assert.ok(!current.completedSectionIds.includes("real-estate"));
  assert.ok(!current.completedSectionIds.includes("mortgage"));
  await assert.rejects(
    service.completeSection(client, { clientCaseId: clientCase.id, sectionId: "mortgage", expectedVersion: current.version }),
    /QUESTIONNAIRE_INCOMPLETE_SECTION/,
  );

  const positiveService = new QuestionnaireService(
    new ClientCaseService(new InMemoryCaseRepository()),
    new InMemoryQuestionnaireRepository(),
    createQuestionnaireDefinition(QUESTIONNAIRE_SECTIONS, 1),
  );
  let positive = await positiveService.getOrCreateForClient(client, clientCase.id);
  positive = await positiveService.saveAnswer(client, { clientCaseId: clientCase.id, fieldId: "hasRealEstate", value: true, expectedVersion: positive.version });
  await assert.rejects(
    positiveService.completeSection(client, { clientCaseId: clientCase.id, sectionId: "real-estate", expectedVersion: positive.version }),
    /QUESTIONNAIRE_INCOMPLETE_SECTION/,
  );

  positive = await positiveService.saveAnswer(client, { clientCaseId: clientCase.id, fieldId: "hasMortgage", value: false, expectedVersion: positive.version });
  positive = await positiveService.completeSection(client, { clientCaseId: clientCase.id, sectionId: "mortgage", expectedVersion: positive.version });
  assert.ok(positive.completedSectionIds.includes("mortgage"));
  positive = await positiveService.saveAnswer(client, { clientCaseId: clientCase.id, fieldId: "hasMortgage", value: true, expectedVersion: positive.version });
  assert.ok(!positive.completedSectionIds.includes("mortgage"));
  await assert.rejects(
    positiveService.completeSection(client, { clientCaseId: clientCase.id, sectionId: "mortgage", expectedVersion: positive.version }),
    /QUESTIONNAIRE_INCOMPLETE_SECTION/,
  );
}

await run();
await runVersionConflictAndReviewIdempotence();
await runPropertyVisibilityRegression();
console.log("questionnaire domain tests: PASS");
