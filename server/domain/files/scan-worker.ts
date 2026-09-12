import type {
  ClaimedStoredFileScan,
  StoredFileRepository,
} from "@/server/domain/files/contracts";

export const FILE_SCAN_INVALID_CONFIG = "FILE_SCAN_INVALID_CONFIG";
export const FILE_SCAN_SCANNER_ERROR = "FILE_SCAN_SCANNER_ERROR";
export const FILE_SCAN_STORAGE_PROVIDER_MISMATCH = "FILE_SCAN_STORAGE_PROVIDER_MISMATCH";

export type MalwareScanVerdict = "CLEAN" | "MALICIOUS";

export class MalwareScannerError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "MalwareScannerError";
  }
}

export interface MalwareScanner {
  readonly providerCode: string;
  scan(input: {
    sourceUrl: string;
    mimeType: string;
    sizeBytes: bigint;
  }): Promise<{ verdict: MalwareScanVerdict }>;
}

export interface MalwareScanObjectStorage {
  readonly providerCode: string;
  createDownloadUrl(input: {
    objectKey: string;
    expiresInSeconds: number;
  }): Promise<{ url: string; expiresAt: Date }>;
}

export type StoredFileScanWorkerConfig = {
  leaseSeconds: number;
  sourceUrlTtlSeconds: number;
  maxAttempts: number;
  retryBaseSeconds: number;
  retryMaxSeconds: number;
};

export type StoredFileScanBatchResult = {
  claimed: number;
  clean: number;
  quarantined: number;
  retried: number;
  failed: number;
  leaseLost: number;
};

function requireIntegerInRange(value: number, min: number, max: number, label: string) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${FILE_SCAN_INVALID_CONFIG}:${label}`);
  }
}

export function assertStoredFileScanWorkerConfig(config: StoredFileScanWorkerConfig) {
  requireIntegerInRange(config.leaseSeconds, 30, 900, "leaseSeconds");
  requireIntegerInRange(config.sourceUrlTtlSeconds, 30, 900, "sourceUrlTtlSeconds");
  requireIntegerInRange(config.maxAttempts, 1, 20, "maxAttempts");
  requireIntegerInRange(config.retryBaseSeconds, 10, 3600, "retryBaseSeconds");
  requireIntegerInRange(config.retryMaxSeconds, config.retryBaseSeconds, 86400, "retryMaxSeconds");
  if (config.sourceUrlTtlSeconds < config.leaseSeconds) {
    throw new Error(`${FILE_SCAN_INVALID_CONFIG}:sourceUrlTtlSeconds`);
  }
}

function safeScannerErrorCode(error: unknown) {
  if (error instanceof MalwareScannerError && /^[A-Z0-9_:-]{1,80}$/.test(error.code)) {
    return error.code;
  }
  return FILE_SCAN_SCANNER_ERROR;
}

export function fileScanRetryDelaySeconds(
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

export class StoredFileScanWorker {
  constructor(
    private readonly repository: StoredFileRepository,
    private readonly storage: MalwareScanObjectStorage,
    private readonly scanner: MalwareScanner,
    private readonly config: StoredFileScanWorkerConfig,
  ) {
    assertStoredFileScanWorkerConfig(config);
  }

  private async processClaim(
    file: ClaimedStoredFileScan,
    now: Date,
    result: StoredFileScanBatchResult,
  ) {
    if (file.storageProvider !== this.storage.providerCode) {
      const failed = await this.repository.markScanFailed({
        fileId: file.id,
        leaseToken: file.scanLeaseToken,
        providerCode: this.scanner.providerCode,
        scannedAt: now,
        errorCode: FILE_SCAN_STORAGE_PROVIDER_MISMATCH,
      });
      if (failed) {
        result.failed += 1;
      } else {
        result.leaseLost += 1;
      }
      return;
    }

    try {
      const signed = await this.storage.createDownloadUrl({
        objectKey: file.objectKey,
        expiresInSeconds: this.config.sourceUrlTtlSeconds,
      });
      const scan = await this.scanner.scan({
        sourceUrl: signed.url,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
      });

      if (scan.verdict === "CLEAN") {
        const ready = await this.repository.markScanClean({
          fileId: file.id,
          leaseToken: file.scanLeaseToken,
          providerCode: this.scanner.providerCode,
          scannedAt: now,
        });
        if (ready) {
          result.clean += 1;
        } else {
          result.leaseLost += 1;
        }
        return;
      }

      const quarantined = await this.repository.markScanQuarantined({
        fileId: file.id,
        leaseToken: file.scanLeaseToken,
        providerCode: this.scanner.providerCode,
        scannedAt: now,
      });
      if (quarantined) {
        result.quarantined += 1;
      } else {
        result.leaseLost += 1;
      }
    } catch (error) {
      const errorCode = safeScannerErrorCode(error);
      if (file.scanAttemptCount >= this.config.maxAttempts) {
        const failed = await this.repository.markScanFailed({
          fileId: file.id,
          leaseToken: file.scanLeaseToken,
          providerCode: this.scanner.providerCode,
          scannedAt: now,
          errorCode,
        });
        if (failed) {
          result.failed += 1;
        } else {
          result.leaseLost += 1;
        }
        return;
      }

      const delaySeconds = fileScanRetryDelaySeconds(
        file.scanAttemptCount,
        this.config.retryBaseSeconds,
        this.config.retryMaxSeconds,
      );
      const retried = await this.repository.rescheduleScan({
        fileId: file.id,
        leaseToken: file.scanLeaseToken,
        providerCode: this.scanner.providerCode,
        errorCode,
        nextAttemptAt: new Date(now.getTime() + delaySeconds * 1000),
      });
      if (retried) {
        result.retried += 1;
      } else {
        result.leaseLost += 1;
      }
    }
  }

  async runBatch(input: { now: Date; limit: number }): Promise<StoredFileScanBatchResult> {
    if (!(input.now instanceof Date) || !Number.isFinite(input.now.getTime())) {
      throw new Error(`${FILE_SCAN_INVALID_CONFIG}:now`);
    }
    requireIntegerInRange(input.limit, 1, 100, "limit");

    const result: StoredFileScanBatchResult = {
      claimed: 0,
      clean: 0,
      quarantined: 0,
      retried: 0,
      failed: 0,
      leaseLost: 0,
    };

    for (let index = 0; index < input.limit; index += 1) {
      const file = await this.repository.claimDueScan({
        now: input.now,
        leaseUntil: new Date(input.now.getTime() + this.config.leaseSeconds * 1000),
      });
      if (!file) break;
      result.claimed += 1;
      await this.processClaim(file, input.now, result);
    }

    return result;
  }
}
