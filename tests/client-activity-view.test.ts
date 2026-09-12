import assert from "node:assert/strict";
import type { CaseActivityRecord } from "@/server/domain/activity/contracts";
import { buildCaseActivityView } from "@/server/activity/presentation";

const createdAt = new Date("2026-08-29T12:00:00.000Z");
const known: CaseActivityRecord = {
  id: "activity-known",
  clientCaseId: "case-1",
  actorUserId: "lawyer-1",
  type: "document.reviewed",
  metadata: { documentId: "internal-document-id", version: 4 },
  createdAt,
};
const unknown: CaseActivityRecord = {
  ...known,
  id: "activity-unknown",
  type: "internal.experimental.event",
  metadata: { internalId: "must-not-reach-client-view" },
};

const clientView = buildCaseActivityView([known, unknown], "CLIENT");
assert.deepEqual(clientView, [
  {
    id: "activity-known",
    label: "Документ проверен",
    createdAt,
    technical: null,
  },
  {
    id: "activity-unknown",
    label: "Событие по делу",
    createdAt,
    technical: null,
  },
]);
assert.doesNotMatch(JSON.stringify(clientView), /internal-document-id|internal\.experimental\.event|must-not-reach-client-view/);

const staffView = buildCaseActivityView([unknown], "STAFF");
assert.equal(staffView[0]?.label, unknown.type);
assert.deepEqual(staffView[0]?.technical, {
  type: unknown.type,
  metadata: unknown.metadata,
});

console.log("CLIENT_ACTIVITY_VIEW_TEST_PASS");
