import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { requireNotificationType } from "@/server/domain/notifications/taxonomy";

for (const type of [
  "questionnaire.completed",
  "practicum.completed",
  "document.ready_for_review",
  "document.reviewed",
] as const) {
  assert.equal(requireNotificationType(type), type);
}

const helperSource = await readFile(
  resolve("server/repositories/prisma/case-notification-write.ts"),
  "utf8",
);
const questionnaireSource = await readFile(
  resolve("server/repositories/prisma/questionnaire-repository.ts"),
  "utf8",
);
const documentSource = await readFile(
  resolve("server/repositories/prisma/document-repository.ts"),
  "utf8",
);
const practicumSource = await readFile(
  resolve("server/repositories/prisma/practicum-progress-repository.ts"),
  "utf8",
);

assert.match(helperSource, /Prisma\.TransactionClient/);
assert.match(helperSource, /notification\.createMany/);
assert.match(helperSource, /skipDuplicates:\s*true/);
assert.match(helperSource, /if \(inserted\.count !== 1\) return false/);
assert.match(helperSource, /type:\s*"notification\.created"/);
assert.match(helperSource, /actorUserId:\s*null/);
assert.match(helperSource, /notificationId/);
assert.match(helperSource, /notificationType:\s*input\.type/);
assert.doesNotMatch(helperSource, /notificationDelivery/);
assert.doesNotMatch(helperSource, /deliveryChannels/);

assert.match(
  questionnaireSource,
  /select:\s*\{\s*caseNumber:\s*true,\s*assignedLawyerId:\s*true\s*\}/,
);
assert.match(questionnaireSource, /userId:\s*clientCase\.assignedLawyerId/);
assert.match(questionnaireSource, /type:\s*"questionnaire\.completed"/);
assert.match(
  questionnaireSource,
  /dedupeKey:\s*`questionnaire\.completed:\$\{input\.clientCaseId\}`/,
);
assert.doesNotMatch(
  questionnaireSource,
  /createCaseNotificationInTransaction[\s\S]{0,240}userId:\s*input\.auditActorUserId/,
);
assert.doesNotMatch(
  questionnaireSource,
  /createCaseNotificationInTransaction[\s\S]{0,500}answers/,
  "questionnaire answers must not be copied into notifications",
);

assert.match(documentSource, /type:\s*"document\.ready_for_review"/);
assert.match(documentSource, /userId:\s*clientCase\.assignedLawyerId/);
assert.match(
  documentSource,
  /dedupeKey:\s*`document\.ready_for_review:\$\{current\.id\}:\$\{input\.expectedVersion \+ 1\}`/,
);
assert.match(documentSource, /type:\s*"document\.reviewed"/);
assert.match(documentSource, /userId:\s*clientCase\.clientId/);
assert.match(
  documentSource,
  /dedupeKey:\s*`document\.reviewed:\$\{current\.id\}:\$\{input\.expectedVersion \+ 1\}`/,
);
assert.doesNotMatch(
  documentSource,
  /body:\s*`[^`]*\$\{input\.documentCode\}/,
  "internal document codes must not be copied into notification body",
);
assert.doesNotMatch(
  documentSource,
  /createCaseNotificationInTransaction[\s\S]{0,240}userId:\s*input\.auditActorUserId/,
);

assert.match(practicumSource, /if \(input\.isFinalLesson\)/);
assert.match(
  practicumSource,
  /select:\s*\{\s*caseNumber:\s*true,\s*assignedLawyerId:\s*true\s*\}/,
);
assert.match(practicumSource, /userId:\s*clientCase\.assignedLawyerId/);
assert.match(practicumSource, /type:\s*"practicum\.completed"/);
assert.match(
  practicumSource,
  /dedupeKey:\s*`practicum\.completed:\$\{input\.clientCaseId\}`/,
);
assert.doesNotMatch(
  practicumSource,
  /createCaseNotificationInTransaction[\s\S]{0,240}userId:\s*input\.auditActorUserId/,
);

console.log("CASE_STATE_NOTIFICATION_CONTRACT_PASS");
