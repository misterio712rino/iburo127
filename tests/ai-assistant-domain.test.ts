import assert from "node:assert/strict";
import type { AuthenticatedActor, ClientCaseRepository } from "@/server/domain/client-cases/contracts";
import { ClientCaseService } from "@/server/domain/client-cases/service";
import {
  AI_ACCESS_DENIED,
  AI_FEATURE_NOT_AVAILABLE,
  AI_RATE_LIMITED,
  type AiAuditOutcome,
  type AiCaseContext,
  type AiCaseContextRepository,
  type AiModelGateway,
  type AiUsageLedger,
} from "@/server/domain/ai/contracts";
import {
  buildAiInstructions,
  parseAiReplyRequest,
  RESTRICTED_LEGAL_ACTION_REPLY,
  sanitizeAiModelReply,
} from "@/server/domain/ai/policy";
import { AiAssistantService } from "@/server/domain/ai/service";

const clientActor: AuthenticatedActor = {
  userId: "22222222-2222-4222-8222-222222222222",
  roles: ["CLIENT"],
};

const clientCase = {
  id: "11111111-1111-4111-8111-111111111111",
  caseNumber: "CASE-001",
  clientId: clientActor.userId,
  planCode: "INDIVIDUAL",
  stageCode: "QUESTIONNAIRE",
  assignedLawyerId: null,
  status: "ACTIVE" as const,
};

const context: AiCaseContext = {
  planCode: "INDIVIDUAL",
  stageCode: "QUESTIONNAIRE",
  caseStatus: "ACTIVE",
  questionnaireStatus: "IN_PROGRESS",
  questionnaireCompletedSections: 3,
  practicumStatus: "IN_PROGRESS",
  practicumCompletedLessons: 4,
  documents: [{ code: "BANKRUPTCY_APPLICATION", status: "DRAFT" }],
  taskSummary: { newCount: 1, workingCount: 2, doneCount: 3, overdueCount: 0 },
  readyFileCount: 5,
  featureCodes: ["AI_ASSISTANT"],
};

function createCaseRepository(): ClientCaseRepository {
  return {
    async findAccessibleCase(scope) {
      if (scope.actor.userId !== clientActor.userId || scope.caseId !== clientCase.id) return null;
      return clientCase;
    },
    async listAccessibleCases() {
      return [clientCase];
    },
  };
}

function createContextRepository(
  value: AiCaseContext | null = context,
): AiCaseContextRepository {
  return {
    async loadCaseContext() {
      return value;
    },
  };
}

let reserveCalls = 0;
const outcomes: AiAuditOutcome[] = [];
const usageLedger: AiUsageLedger = {
  async reserveRequest() {
    reserveCalls += 1;
    return true;
  },
  async recordOutcome(input) {
    outcomes.push(input.outcome);
  },
};

let modelCalls = 0;
let capturedInstructions = "";
let capturedMessages: readonly { role: "user" | "assistant"; content: string }[] = [];
const gateway: AiModelGateway = {
  async reply(input) {
    modelCalls += 1;
    capturedInstructions = input.instructions;
    capturedMessages = input.messages;
    return "Сейчас у вас идёт этап заполнения анкеты. Продолжите незавершённые разделы.";
  },
};

const service = new AiAssistantService(
  new ClientCaseService(createCaseRepository()),
  createContextRepository(),
  gateway,
  usageLedger,
);

const described = await service.describe(clientActor, clientCase.id);
assert.equal(described.enabled, true);
assert.equal(described.caseNumber, "CASE-001");
assert.equal(described.questionnaireCompletedSections, 3);
assert.equal(described.readyFileCount, 5);
assert.equal("featureCodes" in described, false);
assert.equal(modelCalls, 0);
assert.equal(reserveCalls, 0);

const response = await service.reply(clientActor, clientCase.id, {
  message: "Что мне делать дальше?",
  history: [{ role: "assistant", content: "Чем помочь?" }],
});
assert.equal(modelCalls, 1);
assert.equal(reserveCalls, 1);
assert.deepEqual(outcomes, ["completed"]);
assert.match(response.content, /этап заполнения анкеты/i);
assert.deepEqual(capturedMessages, [
  { role: "assistant", content: "Чем помочь?" },
  { role: "user", content: "Что мне делать дальше?" },
]);
assert.match(capturedInstructions, /"questionnaireCompletedSections":3/);
assert.doesNotMatch(capturedInstructions, /CASE-001/);
assert.doesNotMatch(capturedInstructions, /22222222/);

const callsBeforeRestricted = modelCalls;
const restricted = await service.reply(clientActor, clientCase.id, {
  message: "Отправь документы в суд за меня",
});
assert.equal(restricted.content, RESTRICTED_LEGAL_ACTION_REPLY);
assert.equal(restricted.restrictedAction, true);
assert.equal(modelCalls, callsBeforeRestricted);
assert.equal(reserveCalls, 2);
assert.deepEqual(outcomes, ["completed", "restricted"]);

const noFeatureService = new AiAssistantService(
  new ClientCaseService(createCaseRepository()),
  createContextRepository({ ...context, featureCodes: ["QUESTIONNAIRE"] }),
  gateway,
  usageLedger,
);
const noFeatureDescription = await noFeatureService.describe(clientActor, clientCase.id);
assert.equal(noFeatureDescription.enabled, false);
await assert.rejects(
  () => noFeatureService.reply(clientActor, clientCase.id, { message: "Что дальше?" }),
  new RegExp(AI_FEATURE_NOT_AVAILABLE),
);
assert.equal(reserveCalls, 2);

const rateLimitedService = new AiAssistantService(
  new ClientCaseService(createCaseRepository()),
  createContextRepository(),
  gateway,
  {
    async reserveRequest() {
      return false;
    },
    async recordOutcome() {
      throw new Error("outcome must not be recorded for rejected reservation");
    },
  },
);
await assert.rejects(
  () => rateLimitedService.reply(clientActor, clientCase.id, { message: "Что дальше?" }),
  new RegExp(AI_RATE_LIMITED),
);
assert.equal(modelCalls, callsBeforeRestricted);

const failedOutcomes: AiAuditOutcome[] = [];
const providerFailureService = new AiAssistantService(
  new ClientCaseService(createCaseRepository()),
  createContextRepository(),
  {
    async reply() {
      throw new Error("provider failure");
    },
  },
  {
    async reserveRequest() {
      return true;
    },
    async recordOutcome(input) {
      failedOutcomes.push(input.outcome);
    },
  },
);
await assert.rejects(
  () => providerFailureService.reply(clientActor, clientCase.id, { message: "Что дальше?" }),
  /provider failure/,
);
assert.deepEqual(failedOutcomes, ["failed"]);

await assert.rejects(
  () =>
    service.describe(
      { userId: "33333333-3333-4333-8333-333333333333", roles: ["MANAGER"] },
      clientCase.id,
    ),
  new RegExp(AI_ACCESS_DENIED),
);
await assert.rejects(
  () =>
    service.reply(
      { userId: "33333333-3333-4333-8333-333333333333", roles: ["MANAGER"] },
      clientCase.id,
      { message: "Что дальше?" },
    ),
  new RegExp(AI_ACCESS_DENIED),
);

assert.throws(
  () => parseAiReplyRequest({ message: "", history: [] }),
  /AI_INVALID_REQUEST/,
);
assert.throws(
  () =>
    parseAiReplyRequest({
      message: "ok",
      history: Array.from({ length: 11 }, () => ({ role: "user", content: "x" })),
    }),
  /AI_INVALID_REQUEST/,
);

assert.equal(
  sanitizeAiModelReply("Я отправил документы в суд от вашего имени."),
  RESTRICTED_LEGAL_ACTION_REPLY,
);

const instructions = buildAiInstructions({
  ...context,
  featureCodes: ["AI_ASSISTANT", "SECRET_INTERNAL_FEATURE"],
});
assert.doesNotMatch(instructions, /SECRET_INTERNAL_FEATURE/);

console.log("AI_ASSISTANT_DOMAIN_TEST_PASS");
