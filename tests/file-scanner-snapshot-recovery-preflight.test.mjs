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
  folderId: expected.folderId,
  status: "STOPPED",
  bootDisk: { diskId: expected.sourceDiskId },
};
const sourceDisk = {
  id: expected.sourceDiskId,
  folderId: expected.folderId,
  status: "READY",
  zoneId: expected.zone,
  instanceIds: [expected.sourceVmId],
};
const snapshot = {
  id: expected.snapshotId,
  folderId: expected.folderId,
  status: "READY",
  sourceDiskId: expected.sourceDiskId,
};
const helperVm = {
  id: expected.helperVmId,
  folderId: expected.folderId,
  zoneId: expected.zone,
  status: "STOPPED",
  bootDisk: { diskId: "fv4j7cvfquitb287mo92" },
  secondaryDisks: [],
};

assert.equal(
  evaluateRecoveryPreflight({ sourceVm, sourceDisk, snapshot, helperVm, expected }).mode,
  "READ_ONLY_PREFLIGHT_ONLY",
);
for (const [change, code] of [
  [{ sourceVm: { ...sourceVm, status: "RUNNING" } }, "SOURCE_VM_NOT_STOPPED"],
  [{ sourceDisk: { ...sourceDisk, instanceIds: [] } }, "SOURCE_DISK_ATTACHMENT_MISMATCH"],
  [{ snapshot: { ...snapshot, sourceDiskId: helperVm.bootDisk.diskId } }, "SNAPSHOT_SOURCE_DISK_MISMATCH"],
  [{ helperVm: { ...helperVm, secondaryDisks: [{ diskId: expected.sourceDiskId }] } }, "ORIGINAL_DISK_ATTACHED_TO_HELPER"],
  [{ helperVm: { ...helperVm, zoneId: "ru-central1-a" } }, "HELPER_VM_ZONE_MISMATCH"],
]) {
  assert.throws(
    () => evaluateRecoveryPreflight({ sourceVm, sourceDisk, snapshot, helperVm, expected, ...change }),
    new RegExp(`FILE_SCANNER_SNAPSHOT_RECOVERY_PREFLIGHT:${code}`),
  );
}

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
