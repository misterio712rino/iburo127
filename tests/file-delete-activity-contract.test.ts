import assert from "node:assert/strict";
import type { CaseActivityRecord } from "@/server/domain/activity/contracts";
import { requireCaseActivityType } from "@/server/domain/activity/taxonomy";
import { buildCaseActivityView } from "@/server/activity/presentation";

assert.equal(requireCaseActivityType("file.deleted"), "file.deleted");

const createdAt = new Date("2026-09-06T00:00:00.000Z");
const deletedEvent: CaseActivityRecord = {
  id: "activity-file-deleted",
  clientCaseId: "case-1",
  actorUserId: "client-1",
  type: "file.deleted",
  metadata: {
    fileId: "file-1",
    storageProvider: "yandex-object-storage",
    fileStatus: "READY",
  },
  createdAt,
};

const clientView = buildCaseActivityView([deletedEvent], "CLIENT");
assert.deepEqual(clientView, [
  {
    id: deletedEvent.id,
    label: "Файл удалён из дела",
    createdAt,
    technical: null,
  },
]);

const staffView = buildCaseActivityView([deletedEvent], "STAFF");
assert.equal(staffView[0]?.label, "Файл удалён из дела");
assert.deepEqual(staffView[0]?.technical, {
  type: "file.deleted",
  metadata: deletedEvent.metadata,
});

console.log("FILE_DELETE_ACTIVITY_CONTRACT_PASS");
