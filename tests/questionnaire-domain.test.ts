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
    assert.equal(expectedVersion, this.current.version);
  }

  async saveAnswer(input: SaveQuestionnaireAnswerInput) {
    this.assertVersion(input.expectedVersion);
    this.current = {
      ...this.current!,
      status: "IN_PROGRESS",
      answers: { ...this.current!.answers, [input.fieldId]: input.value },
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

async function run() {
  const repository = new InMemoryQuestionnaireRepository();
  const service = new QuestionnaireService(
    new ClientCaseService(new InMemoryCaseRepository()),
    repository,
    createQuestionnaireDefinition(sections, 1),
  );

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

  await assert.rejects(
    service.completeSection(client, {
      clientCaseId: clientCase.id,
      sectionId: "review",
      expectedVersion: current.version,
    }),
    /QUESTIONNAIRE_INCOMPLETE_SECTION/,
  );

  // A hidden conditional required field becomes mandatory when its controlling answer changes.
  current = await service.saveAnswer(client, {
    clientCaseId: clientCase.id,
    fieldId: "employed",
    value: true,
    expectedVersion: current.version,
  });

  await assert.rejects(
    service.completeSection(client, {
      clientCaseId: clientCase.id,
      sectionId: "review",
      expectedVersion: current.version,
    }),
    /QUESTIONNAIRE_INCOMPLETE_SECTION/,
  );

  current = await service.saveAnswer(client, {
    clientCaseId: clientCase.id,
    fieldId: "employmentType",
    value: "employee",
    expectedVersion: current.version,
  });

  // Re-completing the changed section forces current required-field validation.
  current = await service.completeSection(client, {
    clientCaseId: clientCase.id,
    sectionId: "basics",
    expectedVersion: current.version,
  });
  current = await service.completeSection(client, {
    clientCaseId: clientCase.id,
    sectionId: "review",
    expectedVersion: current.version,
  });

  const completed = await service.markCompleted(client, {
    clientCaseId: clientCase.id,
    expectedVersion: current.version,
  });
  assert.equal(completed.status, "COMPLETED");

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

await run();
console.log("questionnaire domain tests: PASS");
