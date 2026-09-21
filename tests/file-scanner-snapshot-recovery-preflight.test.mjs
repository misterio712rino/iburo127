import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  evaluateRecoveryPreflight,
  readOnlyCommands,
} from "../scripts/check-file-scanner-snapshot-recovery-preflight.mjs";

const expected = {
  folderId: "b1ggvchbjvrt2b5rju0g",
  sourceVmId: "fv4djim5ldgphr78lt0h",
  sourceDiskId: "fv4dnod528dsrsuope7s",
  snapshotId: "fd8hgjh5em0hb6ptianq",
  helperVmId: "fv4se4uibe3oqmf1qlfn",
  zone: "ru-central1-d",
};
const sourceVm = {
  id: expected.sourceVmId,
  folder_id: expected.folderId,
  status: "STOPPED",
  boot_disk: { disk_id: expected.sourceDiskId },
};
const sourceDisk = {
  id: expected.sourceDiskId,
  folder_id: expected.folderId,
  status: "READY",
  zone_id: expected.zone,
  instance_ids: [expected.sourceVmId],
};
const snapshot = {
  id: expected.snapshotId,
  folder_id: expected.folderId,
  status: "READY",
  source_disk_id: expected.sourceDiskId,
};
const helperVm = {
  id: expected.helperVmId,
  folder_id: expected.folderId,
  zone_id: expected.zone,
  status: "STOPPED",
  boot_disk: { disk_id: "fv4j7cvfquitb287mo92" },
  secondary_disks: [],
};

assert.equal(
  evaluateRecoveryPreflight({ sourceVm, sourceDisk, snapshot, helperVm, expected }).mode,
  "READ_ONLY_PREFLIGHT_ONLY",
);
for (const [change, code] of [
  [{ sourceVm: { ...sourceVm, status: "RUNNING" } }, "SOURCE_VM_NOT_STOPPED"],
  [{ sourceDisk: { ...sourceDisk, instance_ids: [] } }, "SOURCE_DISK_ATTACHMENT_MISMATCH"],
  [{ snapshot: { ...snapshot, source_disk_id: helperVm.boot_disk.disk_id } }, "SNAPSHOT_SOURCE_DISK_MISMATCH"],
  [{ helperVm: { ...helperVm, secondary_disks: [{ disk_id: expected.sourceDiskId }] } }, "ORIGINAL_DISK_ATTACHED_TO_HELPER"],
  [{ helperVm: { ...helperVm, zone_id: "ru-central1-a" } }, "HELPER_VM_ZONE_MISMATCH"],
]) {
  assert.throws(
    () => evaluateRecoveryPreflight({ sourceVm, sourceDisk, snapshot, helperVm, expected, ...change }),
    new RegExp(`FILE_SCANNER_SNAPSHOT_RECOVERY_PREFLIGHT:${code}`),
  );
}

// Yandex CLI omits empty repeated fields rather than emitting an empty array.
const { secondary_disks: unusedSecondary, ...helperWithoutSecondary } = helperVm;
assert.equal(
  evaluateRecoveryPreflight({ sourceVm, sourceDisk, snapshot, helperVm: helperWithoutSecondary, expected }).mode,
  "READ_ONLY_PREFLIGHT_ONLY",
);
assert.throws(
  () => evaluateRecoveryPreflight({ sourceVm, sourceDisk, snapshot, helperVm: { ...helperVm, secondary_disks: {} }, expected }),
  /FILE_SCANNER_SNAPSHOT_RECOVERY_PREFLIGHT:INVALID_HELPER_SECONDARY_DISKS/,
);
const { folder_id: unusedFolder, ...sourceWithoutFolder } = sourceVm;
assert.throws(
  () => evaluateRecoveryPreflight({ sourceVm: { ...sourceWithoutFolder, folderId: expected.folderId }, sourceDisk, snapshot, helperVm, expected }),
  /FILE_SCANNER_SNAPSHOT_RECOVERY_PREFLIGHT:SOURCE_VM_FOLDER_MISMATCH/,
);
const commands = readOnlyCommands({ ycPath: "fake-yc", ...expected });
assert.equal(commands.length, 4);
for (const command of commands) {
  assert.deepEqual(command.slice(1, 4), ["compute", command[2], "get"]);
  assert.ok(command.includes("--format") && command.includes("json"));
  assert.doesNotMatch(command.join(" "), /\b(?:start|stop|create|delete|attach|detach|update|set|add|remove)\b/i);
}

const script = readFileSync("scripts/check-file-scanner-snapshot-recovery-preflight.mjs", "utf8");
assert.doesNotMatch(script, /\byc\s+compute\s+(?:instance|disk|snapshot)\s+(?:start|stop|create|delete|attach|detach|update)/i);
assert.doesNotMatch(script, /console\.(?:log|error)\([^\n]*(?:stderr|token|secret|metadata|user-data)/i);

console.log("FILE_SCANNER_SNAPSHOT_RECOVERY_PREFLIGHT_CONTRACT_PASS");
