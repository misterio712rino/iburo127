export const FILE_DELETION_MODE_INVALID = "FILE_DELETION_MODE_INVALID";

export type StoredFileDeletionMode = "legacy" | "durable";
type StoredFileDeletionModeEnv = {
  IB_FILE_DELETION_MODE?: string;
};

export function readStoredFileDeletionMode(
  env: StoredFileDeletionModeEnv = process.env,
): StoredFileDeletionMode {
  const raw = env.IB_FILE_DELETION_MODE?.trim();
  if (!raw || raw === "legacy") return "legacy";
  if (raw === "durable") return "durable";
  throw new Error(FILE_DELETION_MODE_INVALID);
}
