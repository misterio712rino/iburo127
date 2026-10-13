import type { RetentionDecision } from "@/server/domain/files/retention-decision-service";

export const FILE_RETENTION_WORKER_INVALID_CONFIG = "FILE_RETENTION_WORKER_INVALID_CONFIG";

export type ClaimedFileRetentionDecision = RetentionDecision & {
  attemptCount: number;
  leaseToken: string;
};

export type FileRetentionDecisionProcessResult =
  | "WAITING_FOR_FILE_DELETIONS"
  | "COMPLETED"
  | "REQUIRES_ATTENTION"
  | "LEASE_LOST";

export interface FileRetentionWorkerRepository {
  claimDueDecision(input: {
    now: Date;
    leaseUntil: Date;
  }): Promise<ClaimedFileRetentionDecision | null>;
  processClaimedDecision(input: {
    clientCaseId: string;
    leaseToken: string;
    now: Date;
  }): Promise<FileRetentionDecisionProcessResult>;
  rescheduleDecision(input: {
    clientCaseId: string;
    leaseToken: string;
    nextAttemptAt: Date;
    errorCode: string;
  }): Promise<boolean>;
  markDecisionRequiresAttention(input: {
    clientCaseId: string;
    leaseToken: string;
    errorCode: string;
  }): Promise<boolean>;
}

export type FileRetentionWorkerConfig = {
  leaseSeconds: number;
  maxAttempts: number;
  retryBaseSeconds: number;
  retryMaxSeconds: number;
};

export type FileRetentionBatchResult = {
  claimed: number;
  completed: number;
  waiting: number;
  retried: number;
  requiresAttention: number;
  leaseLost: number;
};

function requireIntegerInRange(value: number, min: number, max: number, label: string) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${FILE_RETENTION_WORKER_INVALID_CONFIG}:${label}`);
  }
}

export function assertFileRetentionWorkerConfig(config: FileRetentionWorkerConfig) {
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

export function fileRetentionRetryDelaySeconds(
  attemptCount: number,
  baseSeconds: number,
  maxSeconds: number,
) {
  requireIntegerInRange(attemptCount, 1, 1000, "attemptCount");
  requireIntegerInRange(baseSeconds, 1, 86400, "baseSeconds");
  requireIntegerInRange(maxSeconds, baseSeconds, 86400, "maxSeconds");
  return Math.min(baseSeconds * 2 ** Math.min(attemptCount - 1, 20), maxSeconds);
}

function errorCode(error: unknown) {
  if (error instanceof Error && /^[A-Z0-9_:-]{1,80}$/.test(error.message)) {
    return error.message;
  }
  return "FILE_RETENTION_PROCESSING_ERROR";
}

export class FileRetentionWorker {
  constructor(
    private readonly repository: FileRetentionWorkerRepository,
    private readonly config: FileRetentionWorkerConfig,
  ) {
    assertFileRetentionWorkerConfig(config);
  }

  async runBatch(input: { now: Date; limit: number }): Promise<FileRetentionBatchResult> {
    if (!(input.now instanceof Date) || !Number.isFinite(input.now.getTime())) {
      throw new Error(`${FILE_RETENTION_WORKER_INVALID_CONFIG}:now`);
    }
    requireIntegerInRange(input.limit, 1, 100, "limit");

    const result: FileRetentionBatchResult = {
      claimed: 0,
      completed: 0,
      waiting: 0,
      retried: 0,
      requiresAttention: 0,
      leaseLost: 0,
    };

    for (let index = 0; index < input.limit; index += 1) {
      const decision = await this.repository.claimDueDecision({
        now: input.now,
        leaseUntil: new Date(input.now.getTime() + this.config.leaseSeconds * 1000),
      });
      if (!decision) break;
      result.claimed += 1;

      let processResult: FileRetentionDecisionProcessResult;
      try {
        processResult = await this.repository.processClaimedDecision({
          clientCaseId: decision.clientCaseId,
          leaseToken: decision.leaseToken,
          now: input.now,
        });
      } catch (error) {
        const code = errorCode(error);
        if (decision.attemptCount >= this.config.maxAttempts) {
          const marked = await this.repository.markDecisionRequiresAttention({
            clientCaseId: decision.clientCaseId,
            leaseToken: decision.leaseToken,
            errorCode: code,
          });
          if (marked) result.requiresAttention += 1;
          else result.leaseLost += 1;
          continue;
        }

        const delay = fileRetentionRetryDelaySeconds(
          decision.attemptCount,
          this.config.retryBaseSeconds,
          this.config.retryMaxSeconds,
        );
        const retried = await this.repository.rescheduleDecision({
          clientCaseId: decision.clientCaseId,
          leaseToken: decision.leaseToken,
          nextAttemptAt: new Date(input.now.getTime() + delay * 1000),
          errorCode: code,
        });
        if (retried) result.retried += 1;
        else result.leaseLost += 1;
        continue;
      }

      if (processResult === "COMPLETED") {
        result.completed += 1;
      } else if (processResult === "REQUIRES_ATTENTION") {
        result.requiresAttention += 1;
      } else if (processResult === "LEASE_LOST") {
        result.leaseLost += 1;
      } else {
        const delay = fileRetentionRetryDelaySeconds(
          decision.attemptCount,
          this.config.retryBaseSeconds,
          this.config.retryMaxSeconds,
        );
        const retried = await this.repository.rescheduleDecision({
          clientCaseId: decision.clientCaseId,
          leaseToken: decision.leaseToken,
          nextAttemptAt: new Date(input.now.getTime() + delay * 1000),
          errorCode: "FILE_RETENTION_WAITING_FOR_DELETIONS",
        });
        if (retried) result.waiting += 1;
        else result.leaseLost += 1;
      }
    }

    return result;
  }
}
