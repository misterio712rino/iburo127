import "server-only";

import type { StoredFileRepository } from "@/server/domain/files/contracts";
import type { PrivateObjectStorage } from "@/server/files/object-storage-contract";

export const FILE_CLEANUP_INVALID_INPUT = "FILE_CLEANUP_INVALID_INPUT";
export const FILE_CLEANUP_PROVIDER_MISMATCH = "FILE_CLEANUP_PROVIDER_MISMATCH";
export const FILE_CLEANUP_RESTORE_FAILED = "FILE_CLEANUP_RESTORE_FAILED";

export type PendingUploadCleanupResult = {
  inspected: number;
  deleted: number;
  skipped: number;
  failed: number;
};

function assertPositiveInteger(value: number) {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(FILE_CLEANUP_INVALID_INPUT);
  }
}

/**
 * Claims stale metadata with a conditional PENDING_UPLOAD delete before touching
 * private storage. This ordering prevents a cleanup worker from deleting an
 * object after another request has already promoted the row to READY.
 *
 * If storage deletion fails after the claim, the original PENDING_UPLOAD row is
 * restored so a later maintenance run can retry safely. The stale threshold
 * must remain comfortably longer than the signed upload URL lifetime.
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
    let failed = 0;

    for (const file of pending) {
      if (file.storageProvider !== this.storage.providerCode) {
        skipped += 1;
        continue;
      }

      const claimed = await this.repository.deletePending(file.id);
      if (!claimed) {
        skipped += 1;
        continue;
      }

      try {
        await this.storage.deleteObject(file.objectKey);
        deleted += 1;
      } catch {
        const restored = await this.repository.restorePending(file);
        if (!restored) throw new Error(FILE_CLEANUP_RESTORE_FAILED);
        failed += 1;
      }
    }

    return {
      inspected: pending.length,
      deleted,
      skipped,
      failed,
    };
  }
}
