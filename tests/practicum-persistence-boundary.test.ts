import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PRACTICUM_LESSON_IDS } from "@/lib/platform/practicum-content";
import {
  PRACTICUM_COMPLETION_INVALID_DEFINITION,
  computePracticumCompletion,
} from "@/server/domain/practicum/completion";

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
assert.match(completeLessonSource, /if \(transition\.programJustCompleted\)/);
assert.match(completeLessonSource, /if \(transition\.lessonJustCompleted\)/);
assert.doesNotMatch(completeLessonSource, /input\.isFinalLesson/);
assert.match(practicumServiceSource, /requiredLessonIds: this\.definition\.lessonIds/);
assert.match(progressSource, /PRACTICUM_LESSON_IDS\.every/);

const workspaceServiceSource = await readFile(
  resolve("server/domain/practicum/workspace-service.ts"),
  "utf8",
);
assert.match(workspaceServiceSource, /clientPlanHasHumanSupport/);
assert.match(
  workspaceServiceSource,
  /repository\.getLessonWorkspace\(input, actor\)/,
  "practicum workspace service must propagate actor scope to the persistence read",
);
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

const workspaceInputSource = await readFile(resolve("server/practicum/workspace-input.ts"), "utf8");
assert.match(
  workspaceInputSource,
  /expectedVersion: homeworkExpectedVersion\(body\.expectedVersion, true\)/,
  "homework writes must require an explicit expected version, allowing null only for initial create",
);
assert.match(
  workspaceInputSource,
  /expectedVersion: homeworkExpectedVersion\(body\.expectedVersion, false\)/,
  "homework reviews must require a positive expected version",
);

const workspaceRepositorySource = await readFile(
  resolve("server/repositories/prisma/practicum-workspace-repository.ts"),
  "utf8",
);
assert.match(
  workspaceRepositorySource,
  /const HUMAN_SUPPORT_PLAN_CODES = \["PRO", "INDIVIDUAL"\] as const;/,
);
assert.match(
  workspaceRepositorySource,
  /async getLessonWorkspace\([\s\S]*actor\?: AuthenticatedActor/,
  "workspace persistence read must accept the authenticated actor scope",
);
assert.match(
  workspaceRepositorySource,
  /assignedLawyerId: actor\.userId[\s\S]*plan: \{ code: \{ in: \[\.\.\.HUMAN_SUPPORT_PLAN_CODES\] \} \}/,
  "LAWYER workspace reads must require current assignment and human-support plan",
);
assert.match(
  workspaceRepositorySource,
  /casePracticumHomework\.findFirst\([\s\S]*clientCase: accessWhere/,
  "workspace homework read must apply actor access at the final Prisma query",
);
assert.match(
  workspaceRepositorySource,
  /casePracticumLessonMessage\.findMany\([\s\S]*clientCase: accessWhere/,
  "workspace message read must apply actor access at the final Prisma query",
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
assert.match(saveSource, /\(current\?\.version \?\? null\) !== input\.expectedVersion/);
assert.match(submitSource, /\(homework\?\.version \?\? null\) !== input\.expectedVersion/);
assert.match(reviewSource, /homework\.version !== input\.expectedVersion/);
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

// These are source-level CAS regressions, NOT proof of real PostgreSQL interleaving.
assert.match(saveSource, /casePracticumHomework\.updateMany\(\{[\s\S]*version: current\.version,[\s\S]*status: current\.status,/);
assert.match(submitSource, /casePracticumHomework\.updateMany\(\{[\s\S]*version: homework\.version,[\s\S]*status: homework\.status,/);
assert.match(reviewSource, /casePracticumHomework\.updateMany\(\{[\s\S]*version: homework\.version,[\s\S]*status: homework\.status,/);
for (const source of [saveSource, submitSource, reviewSource]) {
  assert.match(source, /updated(?:Homework)?\.count !== 1\) throw new Error\(PRACTICUM_WORKSPACE_STATE_CONFLICT\)/);
}
assert.match(saveSource, /isUniqueConstraintViolation\(error\)\) throw new Error\(PRACTICUM_WORKSPACE_STATE_CONFLICT\)/);
assert.match(submitSource, /isUniqueConstraintViolation\(error\)\) throw new Error\(PRACTICUM_WORKSPACE_STATE_CONFLICT\)/);
assert.match(reviewSource, /casePracticumHomeworkRevision\.updateMany\(\{[\s\S]*homeworkId: homework\.id,[\s\S]*reviewDecision: null,[\s\S]*reviewedAt: null,/);
assert.match(reviewSource, /updatedRevision\.count !== 1\) throw new Error\(PRACTICUM_WORKSPACE_STATE_CONFLICT\)/);
assert.doesNotMatch(reviewSource, /casePracticumHomeworkRevision\.update\(/);

const transportSource = await readFile(resolve("server/practicum/transport.ts"), "utf8");
assert.match(transportSource, /"code" in error && error\.code === "P2034"/);
assert.match(transportSource, /error\.code === "P2034"\) \{\s*return \{ code: "STATE_CONFLICT" as const, status: 409 as const \}/);

const now = new Date("2026-09-18T00:00:00.000Z");
const lesson12 = PRACTICUM_LESSON_IDS.at(-1);
assert.ok(lesson12);
assert.equal(PRACTICUM_LESSON_IDS.length, 12);
const earlyFinal = computePracticumCompletion({
  completedLessonIds: [], lessonId: lesson12,
  requiredLessonIds: PRACTICUM_LESSON_IDS, completedAt: null, now,
});
assert.deepEqual(earlyFinal.completedLessonIds, [lesson12]);
assert.equal(earlyFinal.programJustCompleted, false);
assert.equal(earlyFinal.completedAt, null);
const retry = computePracticumCompletion({
  completedLessonIds: [lesson12], lessonId: lesson12,
  requiredLessonIds: PRACTICUM_LESSON_IDS, completedAt: null, now,
});
assert.equal(retry.lessonJustCompleted, false);
assert.equal(retry.programJustCompleted, false);
assert.equal(retry.completedAt, null);
const actualFinish = computePracticumCompletion({
  completedLessonIds: PRACTICUM_LESSON_IDS.slice(1), lessonId: PRACTICUM_LESSON_IDS[0],
  requiredLessonIds: PRACTICUM_LESSON_IDS, completedAt: null, now,
});
assert.equal(actualFinish.programJustCompleted, true);
assert.equal(actualFinish.completedAt, now);
assert.equal(new Set(actualFinish.completedLessonIds).size, PRACTICUM_LESSON_IDS.length);
const legacyEarly = computePracticumCompletion({
  completedLessonIds: [lesson12], lessonId: lesson12,
  requiredLessonIds: PRACTICUM_LESSON_IDS, completedAt: new Date("2026-09-01"), now,
});
assert.equal(legacyEarly.completedAt, null);
assert.equal(legacyEarly.programJustCompleted, false);
const legacyCorrected = computePracticumCompletion({
  completedLessonIds: PRACTICUM_LESSON_IDS.slice(1), lessonId: PRACTICUM_LESSON_IDS[0],
  requiredLessonIds: PRACTICUM_LESSON_IDS, completedAt: new Date("2026-09-01"), now,
});
assert.equal(legacyCorrected.programJustCompleted, true);
assert.equal(legacyCorrected.completedAt, now);
const fullyCompletedRetry = computePracticumCompletion({
  completedLessonIds: PRACTICUM_LESSON_IDS, lessonId: lesson12,
  requiredLessonIds: PRACTICUM_LESSON_IDS, completedAt: now, now: new Date("2026-09-19"),
});
assert.equal(fullyCompletedRetry.programJustCompleted, false);
assert.equal(fullyCompletedRetry.lessonJustCompleted, false);
assert.equal(fullyCompletedRetry.completedAt, now);
assert.throws(
  () => computePracticumCompletion({
    completedLessonIds: [], lessonId: lesson12,
    requiredLessonIds: [], completedAt: null, now,
  }),
  new RegExp(PRACTICUM_COMPLETION_INVALID_DEFINITION),
);
assert.throws(
  () => computePracticumCompletion({
    completedLessonIds: [], lessonId: "unknown",
    requiredLessonIds: PRACTICUM_LESSON_IDS, completedAt: null, now,
  }),
  new RegExp(PRACTICUM_COMPLETION_INVALID_DEFINITION),
);
console.log("PRACTICUM_COMPLETION_REGRESSION_PASS");
console.log("PRACTICUM_PERSISTENCE_BOUNDARY_PASS");
