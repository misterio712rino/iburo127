import { createHash } from "node:crypto";
import { lstat, readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";

export class MigrationHistoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MigrationHistoryError";
  }
}

export type MigrationHistoryEntry = {
  name: string;
  sqlSha256: string;
  bytes: number;
};

export type MigrationHistorySnapshot = {
  migrationsDirectory: string;
  provider: "postgresql";
  migrationCount: number;
  fingerprint: string;
  migrations: MigrationHistoryEntry[];
};

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function requireRegularFile(path: string, label: string): Promise<string> {
  let stat;
  try {
    stat = await lstat(path);
  } catch {
    throw new MigrationHistoryError(`missing ${label}`);
  }

  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new MigrationHistoryError(`${label} must be a regular file`);
  }

  return readFile(path, "utf8");
}

export async function inspectMigrationHistory(
  migrationsDirectory = resolve("prisma/migrations"),
): Promise<MigrationHistorySnapshot> {
  let rootStat;
  try {
    rootStat = await lstat(migrationsDirectory);
  } catch {
    throw new MigrationHistoryError("prisma/migrations directory is missing; authoritative database baseline is unresolved");
  }

  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    throw new MigrationHistoryError("prisma/migrations must be a real directory");
  }

  const lockContents = await requireRegularFile(
    join(migrationsDirectory, "migration_lock.toml"),
    "prisma/migrations/migration_lock.toml",
  );
  if (!/^\s*provider\s*=\s*"postgresql"\s*$/m.test(lockContents)) {
    throw new MigrationHistoryError('migration_lock.toml must pin provider = "postgresql"');
  }

  const entries = (await readdir(migrationsDirectory, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .sort((left, right) => left.name.localeCompare(right.name));

  if (entries.length === 0) {
    throw new MigrationHistoryError("migration history contains no migration directories");
  }

  const migrations: MigrationHistoryEntry[] = [];
  for (const entry of entries) {
    if (!/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(entry.name)) {
      throw new MigrationHistoryError(`invalid migration directory name: ${entry.name}`);
    }

    const directoryPath = join(migrationsDirectory, entry.name);
    const directoryStat = await lstat(directoryPath);
    if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink()) {
      throw new MigrationHistoryError(`migration directory must not be a symlink: ${entry.name}`);
    }

    const sql = await requireRegularFile(
      join(directoryPath, "migration.sql"),
      `migration SQL for ${entry.name}`,
    );
    if (!sql.trim()) {
      throw new MigrationHistoryError(`migration SQL is empty: ${entry.name}`);
    }

    migrations.push({
      name: entry.name,
      sqlSha256: sha256(sql),
      bytes: Buffer.byteLength(sql, "utf8"),
    });
  }

  const lockSha256 = sha256(lockContents);
  const fingerprintMaterial = [
    `provider:postgresql`,
    `lock:${lockSha256}`,
    ...migrations.map((migration) => `${migration.name}:${migration.sqlSha256}`),
  ].join("\n");

  return {
    migrationsDirectory,
    provider: "postgresql",
    migrationCount: migrations.length,
    fingerprint: sha256(fingerprintMaterial),
    migrations,
  };
}

export function assertPinnedMigrationHistory(
  snapshot: MigrationHistorySnapshot,
  expectedFingerprint: string | undefined,
): void {
  const expected = expectedFingerprint?.trim().toLowerCase();
  if (!expected) {
    throw new MigrationHistoryError("missing IB_STAGING_MIGRATION_HISTORY_SHA256");
  }
  if (!/^[a-f0-9]{64}$/.test(expected)) {
    throw new MigrationHistoryError("IB_STAGING_MIGRATION_HISTORY_SHA256 must be a lowercase SHA-256 hex digest");
  }
  if (snapshot.fingerprint !== expected) {
    throw new MigrationHistoryError("migration history fingerprint does not match the reviewed staging fingerprint");
  }
}
