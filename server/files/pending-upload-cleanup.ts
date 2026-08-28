import "server-only";

import type { StoredFileRepository } from "@/server/domain/files/contracts";
import type { PrivateObjectStorage } from "@/server/files/object-storage-contract";

export const FILE_CLEANUP_INVALID_INPUT = "FILE_CLEANUP_INVALID_INPUT";
export const FILE_CLEANUP_PROVIDER_MISMATCH = "FILE_CLEANUP_PROVIDER_MISMATCH";

export type PendingUploadCleanupResult = {
  inspected: number;
  deleted: number;
  skipped: number;
};

function assertPositiveInteger(value: number) {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(FILE_CLEANUP_INVALID_INPUT);
  }
}

/**
 * Deletes stale PENDING_UPLOAD objects from private storage first and removes
 * their metadata only after object deletion succeeds. READY rows are protected
 * again by the repository's conditional delete.
 *
 * The cleanup is intentionally batch-limited so it can later be invoked by a
 * controlled cron/job without unbounded work in a single execution.
 */
export class PendingUploadCleanupService {
  constructor(
    private readonly repository: StoredFileRepository,
    private readonly storage: PrivateObjectStorage,
  ) {}

  async cleanup(input: {
    before: Date;
    limit?: number;
  }): Promise<PendingUploadCleanupResult> {
    if (!(input.before instanceof Date) || Number.isNaN(input.before.getTime())) {
      throw new Error(FILE_CLEANUP_INVALID_INPUT);
    }

    const limit = input.limit ?? 100;
    assertPositiveInteger(limit);
    if (limit > 500) throw new Error(FILE_CLEANUP_INVALID_INPUT);

    const pending = await this.repository.listPendingBefore(input.before, limit);
    let deleted = 0;
    let skipped = 0;

    for (const file of pending) {
      if (file.storageProvider !== this.storage.providerCode) {
        skipped += 1;
        continue;
      }

      await this.storage.deleteObject(file.objectKey);
      const metadataDeleted = await this.repository.deletePending(file.id);
      if (metadataDeleted) deleted += 1;
      else skipped += 1;
    }

    return {
      inspected: pending.length,
      deleted,
      skipped,
    };
  }
}
