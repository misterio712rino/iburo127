import assert from "node:assert/strict";

import type {
  AuthenticatedActor,
  ClientCaseRecord,
  ClientCaseRepository,
} from "@/server/domain/client-cases/contracts";
import { ClientCaseService } from "@/server/domain/client-cases/service";
import {
  PRACTICUM_WORKSPACE_FORBIDDEN,
  PRACTICUM_WORKSPACE_INVALID_HOMEWORK,
  PRACTICUM_WORKSPACE_INVALID_LESSON,
  PRACTICUM_WORKSPACE_INVALID_MESSAGE,
  PRACTICUM_WORKSPACE_LAWYER_NOT_ASSIGNED,
  type PracticumLessonWorkspaceRecord,
  type PracticumWorkspaceRepository,
} from "@/server/domain/practicum/workspace-contracts";
import { PracticumWorkspaceService } from "@/server/domain/practicum/workspace-service";

const CLIENT_ID = "00000000-0000-0000-0000-000000000001";
const LAWYER_ID = "00000000-0000-0000-0000-000000000002";
const OTHER_LAWYER_ID = "00000000-0000-0000-0000-000000000003";
const MANAGER_ID = "00000000-0000-0000-0000-000000000004";
const CASE_ID = "00000000-0000-0000-0000-000000000010";
const LESSON_ID = "lesson-1";

const clientActor: AuthenticatedActor = { userId: CLIENT_ID, roles: ["CLIENT"] };
const lawyerActor: AuthenticatedActor = { userId: LAWYER_ID, roles: ["LAWYER"] };
const otherLawyerActor: AuthenticatedActor = { userId: OTHER_LAWYER_ID, roles: ["LAWYER"] };
const managerActor: AuthenticatedActor = { userId: MANAGER_ID, roles: ["MANAGER"] };

function makeCase(assignedLawyerId: string | null = LAWYER_ID): ClientCaseRecord {
  return {
    id: CASE_ID,
    caseNumber: "А65-12345/2026",
    clientId: CLIENT_ID,
    planCode: "PRO",
    stageCode: "PRACTICUM",
    assignedLawyerId,
    status: "ACTIVE",
  };
}

class FakeCases implements ClientCaseRepository {
  constructor(private readonly clientCase: ClientCaseRecord) {}

  async findAccessibleCase(scope: { actor: AuthenticatedActor; caseId?: string; caseNumber?: string }) {
    if (scope.caseId && scope.caseId !== this.clientCase.id) return null;
    return this.clientCase;
  }

  async listAccessibleCases() {
    return [this.clientCase];
  }
}

class FakeWorkspace implements PracticumWorkspaceRepository {
  readonly calls: Array<{ name: string; input: unknown }> = [];

  private readonly emptyWorkspace: PracticumLessonWorkspaceRecord = {
    homework: null,
    revisions: [],
    messages: [],
  };

  async getLessonWorkspace(input: { clientCaseId: string; lessonId: string }) {
    this.calls.push({ name: "getLessonWorkspace", input });
    return this.emptyWorkspace;
  }

  async saveHomeworkDraft(input: {
    clientCaseId: string;
    lessonId: string;
    answerText: string;
    actorUserId: string;
  }) {
    this.calls.push({ name: "saveHomeworkDraft", input });
    const now = new Date();
    return {
      id: "homework-1",
      clientCaseId: input.clientCaseId,
      lessonId: input.lessonId,
      status: "DRAFT" as const,
      draftText: input.answerText,
      submittedAt: null,
      reviewedAt: null,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
  }

  async submitHomework(input: {
    clientCaseId: string;
    lessonId: string;
    answerText: string;
    actorUserId: string;
  }) {
    this.calls.push({ name: "submitHomework", input });
    return this.emptyWorkspace;
  }

  async reviewHomework(input: {
    clientCaseId: string;
    lessonId: string;
    decision: "CHANGES_REQUESTED" | "ACCEPTED";
    comment: string;
    actorUserId: string;
  }) {
    this.calls.push({ name: "reviewHomework", input });
    return this.emptyWorkspace;
  }

  async addLessonMessage(input: {
    clientCaseId: string;
    lessonId: string;
    body: string;
    actorUserId: string;
  }) {
    this.calls.push({ name: "addLessonMessage", input });
    return {
      id: "message-1",
      clientCaseId: input.clientCaseId,
      lessonId: input.lessonId,
      authorUserId: input.actorUserId,
      body: input.body,
      createdAt: new Date(),
    };
  }
}

function makeService(assignedLawyerId: string | null = LAWYER_ID) {
  const repository = new FakeWorkspace();
  const cases = new ClientCaseService(new FakeCases(makeCase(assignedLawyerId)));
  return {
    repository,
    service: new PracticumWorkspaceService(cases, repository, {
      lessonIdSet: new Set([LESSON_ID]),
    }),
  };
}

async function expectCode(action: () => Promise<unknown>, code: string) {
  await assert.rejects(action, (error: unknown) => error instanceof Error && error.message === code);
}

{
  const { service, repository } = makeService();
  await service.saveHomeworkDraft(clientActor, {
    clientCaseId: CASE_ID,
    lessonId: LESSON_ID,
    answerText: "  Черновик ответа  ",
  });
  assert.equal(repository.calls.at(-1)?.name, "saveHomeworkDraft");
  assert.deepEqual(repository.calls.at(-1)?.input, {
    clientCaseId: CASE_ID,
    lessonId: LESSON_ID,
    answerText: "Черновик ответа",
    actorUserId: CLIENT_ID,
  });

  await service.submitHomework(clientActor, {
    clientCaseId: CASE_ID,
    lessonId: LESSON_ID,
    answerText: "Готовый ответ",
  });
  assert.equal(repository.calls.at(-1)?.name, "submitHomework");

  await expectCode(
    () => service.submitHomework(clientActor, {
      clientCaseId: CASE_ID,
      lessonId: LESSON_ID,
      answerText: "   ",
    }),
    PRACTICUM_WORKSPACE_INVALID_HOMEWORK,
  );
}

{
  const { service, repository } = makeService();
  await service.reviewHomework(lawyerActor, {
    clientCaseId: CASE_ID,
    lessonId: LESSON_ID,
    decision: "ACCEPTED",
    comment: "",
  });
  assert.equal(repository.calls.at(-1)?.name, "reviewHomework");

  await service.reviewHomework(lawyerActor, {
    clientCaseId: CASE_ID,
    lessonId: LESSON_ID,
    decision: "CHANGES_REQUESTED",
    comment: "Нужно уточнить источник дохода.",
  });
  assert.equal(repository.calls.at(-1)?.name, "reviewHomework");

  await expectCode(
    () => service.reviewHomework(managerActor, {
      clientCaseId: CASE_ID,
      lessonId: LESSON_ID,
      decision: "ACCEPTED",
      comment: "",
    }),
    PRACTICUM_WORKSPACE_FORBIDDEN,
  );

  await expectCode(
    () => service.reviewHomework(otherLawyerActor, {
      clientCaseId: CASE_ID,
      lessonId: LESSON_ID,
      decision: "ACCEPTED",
      comment: "",
    }),
    PRACTICUM_WORKSPACE_FORBIDDEN,
  );
}

{
  const { service, repository } = makeService();
  await service.sendLessonMessage(clientActor, {
    clientCaseId: CASE_ID,
    lessonId: LESSON_ID,
    body: "  Вопрос по уроку  ",
  });
  assert.deepEqual(repository.calls.at(-1)?.input, {
    clientCaseId: CASE_ID,
    lessonId: LESSON_ID,
    body: "Вопрос по уроку",
    actorUserId: CLIENT_ID,
  });

  await service.sendLessonMessage(lawyerActor, {
    clientCaseId: CASE_ID,
    lessonId: LESSON_ID,
    body: "Ответ юриста",
  });
  assert.equal(repository.calls.at(-1)?.name, "addLessonMessage");

  await expectCode(
    () => service.sendLessonMessage(managerActor, {
      clientCaseId: CASE_ID,
      lessonId: LESSON_ID,
      body: "Менеджер не должен отвечать в чате",
    }),
    PRACTICUM_WORKSPACE_FORBIDDEN,
  );

  await expectCode(
    () => service.sendLessonMessage(clientActor, {
      clientCaseId: CASE_ID,
      lessonId: LESSON_ID,
      body: "",
    }),
    PRACTICUM_WORKSPACE_INVALID_MESSAGE,
  );
}

{
  const { service } = makeService(null);
  await expectCode(
    () => service.sendLessonMessage(clientActor, {
      clientCaseId: CASE_ID,
      lessonId: LESSON_ID,
      body: "Кому уйдёт вопрос?",
    }),
    PRACTICUM_WORKSPACE_LAWYER_NOT_ASSIGNED,
  );
}

{
  const { service, repository } = makeService();
  await service.getLessonWorkspace(managerActor, { clientCaseId: CASE_ID, lessonId: LESSON_ID });
  assert.equal(repository.calls.at(-1)?.name, "getLessonWorkspace");

  await expectCode(
    () => service.getLessonWorkspace(clientActor, { clientCaseId: CASE_ID, lessonId: "unknown" }),
    PRACTICUM_WORKSPACE_INVALID_LESSON,
  );
}

console.log("PRACTICUM_WORKSPACE_DOMAIN_TEST_PASS");
