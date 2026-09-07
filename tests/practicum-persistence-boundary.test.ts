import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const source = await readFile(
  resolve("server/repositories/prisma/practicum-progress-repository.ts"),
  "utf8",
);

const completeLessonStart = source.indexOf("  async completeLesson(");
assert.ok(completeLessonStart >= 0, "completeLesson persistence path must exist");

const completeLessonSource = source.slice(completeLessonStart);

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
  source,
  /const HUMAN_SUPPORT_PLAN_CODES = \["PRO", "INDIVIDUAL"\] as const;/,
  "LITE must never enter the practicum lawyer-notification path",
);

console.log("PRACTICUM_PERSISTENCE_BOUNDARY_PASS");
