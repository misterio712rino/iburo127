import type {
  ClaimedStoredFileDeletion,
  StoredFileDeletionRepository,
} from "@/server/domain/files/deletion-contracts";

export const FILE_DELETION_INVALID_CONFIG = "FILE_DELETION_INVALID_CONFIG";
export const FILE_DELETION_STORAGE_ERROR = "FILE_DELETION_STORAGE_ERROR";
export const FILE_DELETION_STORAGE_PROVIDER_MISMATCH =
  "FILE_DELETION_STORAGE_PROVIDER_MISMATCH";

export class FileDeletionStorageError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "FileDeletionStorageError";
  }
}

export interface FileDeletionObjectStorage {
  readonly providerCode: string;
  /** Must be idempotent: an already-absent object is a successful deletion. */
  deleteObject(objectKey: string): Promise<void>;
}

export type StoredFileDeletionWorkerConfig = {
  leaseSeconds: number;
  maxAttempts: number;
  retryBaseSeconds: number;
  retryMaxSeconds: number;
};

export type StoredFileDeletionBatchResult = {
  claimed: number;
  completed: number;
  retried: number;
  requiresAttention: number;
  leaseLost: number;
  finalizationDeferred: number;
};

function requireIntegerInRange(value: number, min: number, max: number, label: string) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${FILE_DELETION_INVALID_CONFIG}:${label}`);
  }
}

export function assertStoredFileDeletionWorkerConfig(config: StoredFileDeletionWorkerConfig) {
  requireIntegerInRange(config.leaseSeconds, 30, 900, "leaseSeconds");
  requireIntegerInRange(config.maxAttempts, 1, 20, "maxAttempts");
  requireIntegerInRange(config.retryBaseSeconds, 10, 3600, "retryBaseSeconds");
  requireIntegerInRange(
    config.retryMaxSeconds,
    config.retryBaseSeconds,
    86400,
    "retryMaxSeconds",
  );
}

export function fileDeletionRetryDelaySeconds(
  attemptCount: number,
  baseSeconds: number,
  maxSeconds: number,
) {
  requireIntegerInRange(attemptCount, 1, 1000, "attemptCount");
  requireIntegerInRange(baseSeconds, 1, 86400, "baseSeconds");
  requireIntegerInRange(maxSeconds, baseSeconds, 86400, "maxSeconds");
  const multiplier = 2 ** Math.min(attemptCount - 1, 20);
  return Math.min(baseSeconds * multiplier, maxSeconds);
}

function safeStorageErrorCode(error: unknown) {
  if (error instanceof FileDeletionStorageError && /^[A-Z0-9_:-]{1,80}$/.test(error.code)) {
    return error.code;
  }
  return FILE_DELETION_STORAGE_ERROR;
}

export class StoredFileDeletionWorker {
  constructor(
    private readonly repository: StoredFileDeletionRepository,
    private readonly storage: FileDeletionObjectStorage,
    private readonly config: StoredFileDeletionWorkerConfig,
  ) {
    assertStoredFileDeletionWorkerConfig(config);
  }

  private async markAttention(
    deletion: ClaimedStoredFileDeletion,
    errorCode: string,
    result: StoredFileDeletionBatchResult,
  ) {
    const marked = await this.repository.markDeletionRequiresAttention({
      fileId: deletion.fileId,
      leaseToken: deletion.leaseToken,
      errorCode,
    });
    if (marked) result.requiresAttention += 1;
    else result.leaseLost += 1;
  }

  private async processClaim(
    deletion: ClaimedStoredFileDeletion,
    now: Date,
    result: StoredFileDeletionBatchResult,
  ) {
    if (deletion.storageProvider !== this.storage.providerCode) {
      await this.markAttention(
        deletion,
        FILE_DELETION_STORAGE_PROVIDER_MISMATCH,
        result,
      );
      return;
    }

    try {
      await this.storage.deleteObject(deletion.objectKey);
    } catch (error) {
      const errorCode = safeStorageErrorCode(error);
      if (deletion.attemptCount >= this.config.maxAttempts) {
        await this.markAttention(deletion, errorCode, result);
        return;
      }

      const delaySeconds = fileDeletionRetryDelaySeconds(
        deletion.attemptCount,
        this.config.retryBaseSeconds,
        this.config.retryMaxSeconds,
      );
      const retried = await this.repository.rescheduleDeletion({
        fileId: deletion.fileId,
        leaseToken: deletion.leaseToken,
        nextAttemptAt: new Date(now.getTime() + delaySeconds * 1000),
        errorCode,
      });
      if (retried) result.retried += 1;
      else result.leaseLost += 1;
      return;
    }

    try {
      const finalized = await this.repository.finalizeDeletion({
        fileId: deletion.fileId,
        leaseToken: deletion.leaseToken,
        storageConfirmedAt: now,
        completedAt: now,
      });
      if (finalized) result.completed += 1;
      else result.leaseLost += 1;
    } catch {
      // Storage deletion is irreversible. Never manufacture completion or restore
      // the active file row here. The PROCESSING lease remains durable and can be
      // reclaimed; the next attempt repeats the idempotent object delete before
      // retrying the atomic audit+COMPLETED transaction.
      result.finalizationDeferred += 1;
    }
  }

  async runBatch(input: { now: Date; limit: number }): Promise<StoredFileDeletionBatchResult> {
    if (!(input.now instanceof Date) || !Number.isFinite(input.now.getTime())) {
      throw new Error(`${FILE_DELETION_INVALID_CONFIG}:now`);
    }
    requireIntegerInRange(input.limit, 1, 100, "limit");

    const result: StoredFileDeletionBatchResult = {
      claimed: 0,
      completed: 0,
      retried: 0,
      requiresAttention: 0,
      leaseLost: 0,
      finalizationDeferred: 0,
    };

    for (let index = 0; index < input.limit; index += 1) {
      const deletion = await this.repository.claimDueDeletion({
        now: input.now,
        leaseUntil: new Date(input.now.getTime() + this.config.leaseSeconds * 1000),
      });
      if (!deletion) break;
      result.claimed += 1;
      await this.processClaim(deletion, input.now, result);
    }

    return result;
  }
}
