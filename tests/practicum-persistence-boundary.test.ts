import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const progressSource = await readFile(
  resolve("server/repositories/prisma/practicum-progress-repository.ts"),
  "utf8",
);
const practicumServiceSource = await readFile(
  resolve("server/domain/practicum/service.ts"),
  "utf8",
);

assert.match(
  progressSource,
  /async getByClientCaseId\(clientCaseId: string, actor\?: AuthenticatedActor\)/,
  "practicum progress persistence read must accept the authenticated actor scope",
);
assert.match(
  progressSource,
  /assignedLawyerId: actor\.userId[\s\S]*plan: \{ code: \{ in: \[\.\.\.HUMAN_SUPPORT_PLAN_CODES\] \} \}/,
  "LAWYER practicum progress reads must require current assignment and human-support plan",
);
assert.match(
  progressSource,
  /clientCase: \{[\s\S]*is: \{ OR: access \}/,
  "practicum progress read must apply actor access at the final Prisma query",
);
assert.match(
  practicumServiceSource,
  /repository\.getByClientCaseId\(clientCaseId, actor\)/,
  "practicum service must propagate actor scope to the persistence read",
);

const completeLessonStart = progressSource.indexOf("  async completeLesson(");
assert.ok(completeLessonStart >= 0, "completeLesson persistence path must exist");

const completeLessonSource = progressSource.slice(completeLessonStart);

assert.match(
  completeLessonSource,
  /casePracticumProgress\.findFirst\([\s\S]*clientCase: \{ clientId: input\.auditActorUserId \}/,
  "practicum mutation must load progress through the current CLIENT owner relation",
);
assert.match(
  completeLessonSource,
  /updateMany\([\s\S]*clientCase: \{ clientId: input\.auditActorUserId \}/,
  "practicum mutation must atomically re-check the current CLIENT owner during update",
);
assert.match(
  completeLessonSource,
  /clientCase\.findFirst\([\s\S]*clientId: input\.auditActorUserId/,
  "completion notification lookup must remain scoped to the current CLIENT owner",
);
assert.match(
  completeLessonSource,
  /assignedLawyerId: \{ not: null \}/,
  "completion notification must require an assigned lawyer",
);
assert.match(
  completeLessonSource,
  /plan: \{ code: \{ in: \[\.\.\.HUMAN_SUPPORT_PLAN_CODES\] \} \}/,
  "completion notification must require a human-support plan",
);
assert.match(
  progressSource,
  /const HUMAN_SUPPORT_PLAN_CODES = \["PRO", "INDIVIDUAL"\] as const;/,
  "LITE must never enter the practicum lawyer-notification path",
);

const workspaceServiceSource = await readFile(
  resolve("server/domain/practicum/workspace-service.ts"),
  "utf8",
);
assert.match(workspaceServiceSource, /clientPlanHasHumanSupport/);
assert.match(
  workspaceServiceSource,
  /function hideHumanSupportWorkspace\([\s\S]*reviewedByUserId: null[\s\S]*reviewDecision: null[\s\S]*reviewComment: null[\s\S]*messages: \[\]/,
  "LITE workspace responses must hide historical lawyer review and messaging data",
);
assert.match(
  workspaceServiceSource,
  /async sendLessonMessage\([\s\S]*if \(!clientPlanHasHumanSupport\(clientCase\.planCode\)\)[\s\S]*PRACTICUM_WORKSPACE_FORBIDDEN/,
  "LITE must not enter lesson messaging even with a stale assigned lawyer",
);

const workspaceRepositorySource = await readFile(
  resolve("server/repositories/prisma/practicum-workspace-repository.ts"),
  "utf8",
);
assert.match(
  workspaceRepositorySource,
  /const HUMAN_SUPPORT_PLAN_CODES = \["PRO", "INDIVIDUAL"\] as const;/,
);

const saveStart = workspaceRepositorySource.indexOf("  async saveHomeworkDraft(");
const submitStart = workspaceRepositorySource.indexOf("  async submitHomework(");
const reviewStart = workspaceRepositorySource.indexOf("  async reviewHomework(");
const messageStart = workspaceRepositorySource.indexOf("  async addLessonMessage(");
assert.ok(
  saveStart >= 0 && submitStart > saveStart && reviewStart > submitStart && messageStart > reviewStart,
  "all practicum workspace mutation paths must exist",
);

const saveSource = workspaceRepositorySource.slice(saveStart, submitStart);
const submitSource = workspaceRepositorySource.slice(submitStart, reviewStart);
const reviewSource = workspaceRepositorySource.slice(reviewStart, messageStart);
const messageSource = workspaceRepositorySource.slice(messageStart);

assert.match(saveSource, /clientCase\.findFirst\([\s\S]*clientId: input\.actorUserId/);
assert.match(saveSource, /updateMany\([\s\S]*clientCase: \{ clientId: input\.actorUserId \}/);

assert.match(submitSource, /clientCase\.findFirst\([\s\S]*clientId: input\.actorUserId/);
assert.match(submitSource, /updateMany\([\s\S]*clientCase: \{ clientId: input\.actorUserId \}/);
assert.match(submitSource, /assignedLawyerId: \{ not: null \}/);
assert.match(submitSource, /plan: \{ code: \{ in: \[\.\.\.HUMAN_SUPPORT_PLAN_CODES\] \} \}/);

assert.match(reviewSource, /casePracticumHomework\.findFirst\([\s\S]*assignedLawyerId: input\.actorUserId/);
assert.match(reviewSource, /casePracticumHomework\.findFirst\([\s\S]*plan: \{ code: \{ in: \[\.\.\.HUMAN_SUPPORT_PLAN_CODES\] \} \}/);
assert.match(reviewSource, /updateMany\([\s\S]*assignedLawyerId: input\.actorUserId/);
assert.match(reviewSource, /updateMany\([\s\S]*plan: \{ code: \{ in: \[\.\.\.HUMAN_SUPPORT_PLAN_CODES\] \} \}/);

assert.match(messageSource, /clientCase\.findFirst\([\s\S]*plan: \{ code: \{ in: \[\.\.\.HUMAN_SUPPORT_PLAN_CODES\] \} \}/);
assert.match(messageSource, /OR: \[[\s\S]*clientId: input\.actorUserId[\s\S]*assignedLawyerId: input\.actorUserId/);

console.log("PRACTICUM_PERSISTENCE_BOUNDARY_PASS");
