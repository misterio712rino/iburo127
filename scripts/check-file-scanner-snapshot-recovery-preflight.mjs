import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const SAFE_ID = /^[a-z0-9]{8,64}$/;
const SAFE_ZONE = /^ru-central1-[a-d]$/;

function fail(code) {
  throw new Error(`FILE_SCANNER_SNAPSHOT_RECOVERY_PREFLIGHT:${code}`);
}

function requireId(value, code) {
  if (typeof value !== "string" || !SAFE_ID.test(value)) fail(code);
  return value;
}

function requireExact(actual, expected, code) {
  if (actual !== expected) fail(code);
}

function getBootDiskId(instance, code) {
  const diskId = instance?.bootDisk?.diskId;
  if (typeof diskId !== "string" || !SAFE_ID.test(diskId)) fail(code);
  return diskId;
}

function getAttachedDiskIds(instance) {
  const ids = [getBootDiskId(instance, "INVALID_HELPER_BOOT_DISK")];
  if (!Array.isArray(instance?.secondaryDisks)) fail("INVALID_HELPER_SECONDARY_DISKS");
  for (const disk of instance.secondaryDisks) {
    if (typeof disk?.diskId !== "string" || !SAFE_ID.test(disk.diskId)) {
      fail("INVALID_HELPER_SECONDARY_DISK");
    }
    ids.push(disk.diskId);
  }
  return ids;
}

function validateExpected(expected) {
  const sourceVmId = requireId(expected.sourceVmId, "INVALID_SOURCE_VM_ID");
  const sourceDiskId = requireId(expected.sourceDiskId, "INVALID_SOURCE_DISK_ID");
  const snapshotId = requireId(expected.snapshotId, "INVALID_SNAPSHOT_ID");
  const helperVmId = requireId(expected.helperVmId, "INVALID_HELPER_VM_ID");
  const folderId = requireId(expected.folderId, "INVALID_FOLDER_ID");
  if (typeof expected.zone !== "string" || !SAFE_ZONE.test(expected.zone)) fail("INVALID_ZONE");
  return { sourceVmId, sourceDiskId, snapshotId, helperVmId, folderId, zone: expected.zone };
}

/**
 * Validate only JSON obtained from `yc compute ... get --format json`.
 * It performs no mutation and intentionally rejects incomplete or ambiguous data.
 */
export function evaluateRecoveryPreflight({ sourceVm, sourceDisk, snapshot, helperVm, expected }) {
  const { sourceVmId, sourceDiskId, snapshotId, helperVmId, folderId, zone } = validateExpected(expected);

  requireExact(sourceVm?.id, sourceVmId, "SOURCE_VM_ID_MISMATCH");
  requireExact(sourceVm?.folderId, folderId, "SOURCE_VM_FOLDER_MISMATCH");
  requireExact(sourceVm?.status, "STOPPED", "SOURCE_VM_NOT_STOPPED");
  requireExact(getBootDiskId(sourceVm, "INVALID_SOURCE_BOOT_DISK"), sourceDiskId, "SOURCE_BOOT_DISK_MISMATCH");

  requireExact(sourceDisk?.id, sourceDiskId, "SOURCE_DISK_ID_MISMATCH");
  requireExact(sourceDisk?.folderId, folderId, "SOURCE_DISK_FOLDER_MISMATCH");
  requireExact(sourceDisk?.status, "READY", "SOURCE_DISK_NOT_READY");
  requireExact(sourceDisk?.zoneId, zone, "SOURCE_DISK_ZONE_MISMATCH");
  if (!Array.isArray(sourceDisk?.instanceIds) || sourceDisk.instanceIds.length !== 1
    || sourceDisk.instanceIds[0] !== sourceVmId) fail("SOURCE_DISK_ATTACHMENT_MISMATCH");

  requireExact(snapshot?.id, snapshotId, "SNAPSHOT_ID_MISMATCH");
  requireExact(snapshot?.folderId, folderId, "SNAPSHOT_FOLDER_MISMATCH");
  requireExact(snapshot?.status, "READY", "SNAPSHOT_NOT_READY");
  requireExact(snapshot?.sourceDiskId, sourceDiskId, "SNAPSHOT_SOURCE_DISK_MISMATCH");

  requireExact(helperVm?.id, helperVmId, "HELPER_VM_ID_MISMATCH");
  requireExact(helperVm?.folderId, folderId, "HELPER_VM_FOLDER_MISMATCH");
  requireExact(helperVm?.zoneId, zone, "HELPER_VM_ZONE_MISMATCH");
  requireExact(helperVm?.status, "STOPPED", "HELPER_VM_NOT_STOPPED");
  if (getAttachedDiskIds(helperVm).includes(sourceDiskId)) fail("ORIGINAL_DISK_ATTACHED_TO_HELPER");

  return Object.freeze({
    sourceVmId,
    sourceDiskId,
    snapshotId,
    helperVmId,
    folderId,
    zone,
    mode: "READ_ONLY_PREFLIGHT_ONLY",
  });
}

export function readOnlyCommands({ ycPath, sourceVmId, sourceDiskId, snapshotId, helperVmId }) {
  return [
    [ycPath, "compute", "instance", "get", "--id", sourceVmId, "--format", "json"],
    [ycPath, "compute", "disk", "get", "--id", sourceDiskId, "--format", "json"],
    [ycPath, "compute", "snapshot", "get", "--id", snapshotId, "--format", "json"],
    [ycPath, "compute", "instance", "get", "--id", helperVmId, "--format", "json"],
  ];
}

function parseOptions(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || value?.startsWith("--") || value === undefined) fail("INVALID_ARGUMENTS");
    values[key.slice(2)] = value;
  }
  return values;
}

function fetchJson(command) {
  const result = spawnSync(command[0], command.slice(1), { encoding: "utf8", windowsHide: true });
  if (result.error || result.status !== 0) fail("YC_READ_ONLY_QUERY_FAILED");
  try {
    return JSON.parse(result.stdout);
  } catch {
    fail("YC_READ_ONLY_JSON_INVALID");
  }
}

function main() {
  const options = parseOptions(process.argv.slice(2));
  const expected = {
    folderId: options["folder-id"],
    sourceVmId: options["source-vm-id"],
    sourceDiskId: options["source-disk-id"],
    snapshotId: options["snapshot-id"],
    helperVmId: options["helper-vm-id"],
    zone: options.zone,
  };
  const checkedExpected = validateExpected(expected);
  const commands = readOnlyCommands({
    ycPath: options.yc ?? "yc",
    ...checkedExpected,
  });
  const [sourceVm, sourceDisk, snapshot, helperVm] = commands.map(fetchJson);
  const result = evaluateRecoveryPreflight({ sourceVm, sourceDisk, snapshot, helperVm, expected: checkedExpected });
  console.log(`FILE_SCANNER_SNAPSHOT_RECOVERY_PREFLIGHT_PASS: ${result.mode}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : "FILE_SCANNER_SNAPSHOT_RECOVERY_PREFLIGHT:UNKNOWN_ERROR");
    process.exitCode = 1;
  }
}
