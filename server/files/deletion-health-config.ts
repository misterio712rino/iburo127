export const FILE_DELETION_HEALTH_CONFIG_INVALID = "FILE_DELETION_HEALTH_CONFIG_INVALID";

type FileDeletionHealthEnv = Record<string, string | undefined>;

function readInteger(
  env: FileDeletionHealthEnv,
  name: string,
  fallback: number,
  min: number,
  max: number,
) {
  const raw = env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${FILE_DELETION_HEALTH_CONFIG_INVALID}:${name}`);
  }
  return value;
}

export function readStoredFileDeletionHealthConfig(
  env: FileDeletionHealthEnv = process.env,
) {
  return {
    graceMinutes: readInteger(env, "IB_FILE_DELETION_HEALTH_GRACE_MINUTES", 15, 2, 1_440),
    batchLimit: readInteger(env, "IB_FILE_DELETION_HEALTH_BATCH_LIMIT", 50, 1, 200),
  };
}
