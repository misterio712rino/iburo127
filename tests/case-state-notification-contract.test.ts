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

function notificationCallFor(source: string, type: string) {
  const marker = `type: "${type}"`;
  const typeIndex = source.indexOf(marker);
  assert.ok(typeIndex >= 0, `missing ${type} notification`);
  const callStart = source.lastIndexOf("createCaseNotificationInTransaction(tx, {", typeIndex);
  assert.ok(callStart >= 0, `missing transactional writer for ${type}`);
  const callEnd = source.indexOf("});", typeIndex);
  assert.ok(callEnd > typeIndex, `unterminated transactional writer for ${type}`);
  return source.slice(callStart, callEnd + 3);
}

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
const questionnaireNotification = notificationCallFor(
  questionnaireSource,
  "questionnaire.completed",
);
assert.match(questionnaireNotification, /userId:\s*clientCase\.assignedLawyerId/);
assert.match(
  questionnaireNotification,
  /dedupeKey:\s*`questionnaire\.completed:\$\{input\.clientCaseId\}`/,
);
assert.doesNotMatch(questionnaireNotification, /auditActorUserId|answers|fieldId|input\.value/);

const readyForReviewNotification = notificationCallFor(
  documentSource,
  "document.ready_for_review",
);
assert.match(readyForReviewNotification, /userId:\s*clientCase\.assignedLawyerId/);
assert.match(
  readyForReviewNotification,
  /dedupeKey:\s*`document\.ready_for_review:\$\{current\.id\}:\$\{input\.expectedVersion \+ 1\}`/,
);
assert.doesNotMatch(readyForReviewNotification, /auditActorUserId|input\.documentCode/);

const reviewedNotification = notificationCallFor(documentSource, "document.reviewed");
assert.match(reviewedNotification, /userId:\s*clientCase\.clientId/);
assert.match(
  reviewedNotification,
  /dedupeKey:\s*`document\.reviewed:\$\{current\.id\}:\$\{input\.expectedVersion \+ 1\}`/,
);
assert.doesNotMatch(reviewedNotification, /auditActorUserId|input\.documentCode/);

assert.match(practicumSource, /if \(input\.isFinalLesson\)/);
assert.match(
  practicumSource,
  /select:\s*\{\s*caseNumber:\s*true,\s*assignedLawyerId:\s*true\s*\}/,
);
const practicumNotification = notificationCallFor(practicumSource, "practicum.completed");
assert.match(practicumNotification, /userId:\s*clientCase\.assignedLawyerId/);
assert.match(
  practicumNotification,
  /dedupeKey:\s*`practicum\.completed:\$\{input\.clientCaseId\}`/,
);
assert.doesNotMatch(practicumNotification, /auditActorUserId|lessonId/);

console.log("CASE_STATE_NOTIFICATION_CONTRACT_PASS");
