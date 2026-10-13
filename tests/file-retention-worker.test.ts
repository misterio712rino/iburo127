import assert from "node:assert/strict";
import type { RetentionDecision } from "@/server/domain/files/retention-decision-service";
import {
  FileRetentionWorker,
  fileRetentionRetryDelaySeconds,
  type ClaimedFileRetentionDecision,
  type FileRetentionDecisionProcessResult,
  type FileRetentionWorkerRepository,
} from "@/server/domain/files/retention-worker";

const now = new Date("2026-10-13T12:00:00.000Z");
const leaseToken = "00000000-0000-4000-8000-000000000001";

function claimed(attemptCount = 1): ClaimedFileRetentionDecision {
  const decision: RetentionDecision = {
    clientCaseId: "case-1",
    requestedByUserId: "client-1",
    choice: "DELETE_NOW",
    policyVersion: "2026-10-13",
    procedureCompletedAt: new Date("2026-01-01T00:00:00.000Z"),
    deleteAt: now,
    decidedAt: now,
  };
  return { ...decision, attemptCount, leaseToken };
}

class FakeRepository implements FileRetentionWorkerRepository {
  nextClaim: ClaimedFileRetentionDecision | null;

  constructor(nextClaim: ClaimedFileRetentionDecision | null = claimed()) {
    this.nextClaim = nextClaim;
  }
  processResult: FileRetentionDecisionProcessResult = "COMPLETED";
  processError: Error | null = null;
  rescheduled: Parameters<FileRetentionWorkerRepository["rescheduleDecision"]>[0] | null = null;
  attention: Parameters<FileRetentionWorkerRepository["markDecisionRequiresAttention"]>[0] | null = null;

  async claimDueDecision(input: { now: Date; leaseUntil: Date }) {
    assert.equal(input.now, now);
    assert.equal(input.leaseUntil.getTime(), now.getTime() + 120_000);
    const value = this.nextClaim;
    this.nextClaim = null;
    return value;
  }

  async processClaimedDecision(input: Parameters<FileRetentionWorkerRepository["processClaimedDecision"]>[0]) {
    assert.equal(input.clientCaseId, "case-1");
    assert.equal(input.leaseToken, leaseToken);
    if (this.processError) throw this.processError;
    return this.processResult;
  }

  async rescheduleDecision(input: Parameters<FileRetentionWorkerRepository["rescheduleDecision"]>[0]) {
    this.rescheduled = input;
    return true;
  }

  async markDecisionRequiresAttention(input: Parameters<FileRetentionWorkerRepository["markDecisionRequiresAttention"]>[0]) {
    this.attention = input;
    return true;
  }
}

function makeWorker(repository: FakeRepository) {
  return new FileRetentionWorker(repository, {
    leaseSeconds: 120,
    maxAttempts: 3,
    retryBaseSeconds: 60,
    retryMaxSeconds: 300,
  });
}

assert.equal(fileRetentionRetryDelaySeconds(1, 60, 300), 60);
assert.equal(fileRetentionRetryDelaySeconds(3, 60, 300), 240);
assert.equal(fileRetentionRetryDelaySeconds(8, 60, 300), 300);

{
  const repository = new FakeRepository();
  const result = await makeWorker(repository).runBatch({ now, limit: 1 });
  assert.deepEqual(result, {
    claimed: 1,
    completed: 1,
    waiting: 0,
    retried: 0,
    requiresAttention: 0,
    leaseLost: 0,
  });
}

{
  const repository = new FakeRepository();
  repository.processResult = "WAITING_FOR_FILE_DELETIONS";
  const result = await makeWorker(repository).runBatch({ now, limit: 1 });
  assert.equal(result.waiting, 1);
  assert.equal(repository.rescheduled?.errorCode, "FILE_RETENTION_WAITING_FOR_DELETIONS");
  assert.equal(repository.rescheduled?.nextAttemptAt.getTime(), now.getTime() + 60_000);
}

{
  const repository = new FakeRepository(claimed(2));
  repository.processError = new Error("FILE_RETENTION_DATABASE_BUSY");
  const result = await makeWorker(repository).runBatch({ now, limit: 1 });
  assert.equal(result.retried, 1);
  assert.equal(repository.rescheduled?.errorCode, "FILE_RETENTION_DATABASE_BUSY");
  assert.equal(repository.rescheduled?.nextAttemptAt.getTime(), now.getTime() + 120_000);
}

{
  const repository = new FakeRepository(claimed(3));
  repository.processError = new Error("object-store access token leaked");
  const result = await makeWorker(repository).runBatch({ now, limit: 1 });
  assert.equal(result.requiresAttention, 1);
  assert.equal(repository.attention?.errorCode, "FILE_RETENTION_PROCESSING_ERROR");
  assert.doesNotMatch(repository.attention?.errorCode ?? "", /token|leaked/i);
}

{
  const repository = new FakeRepository();
  repository.processResult = "LEASE_LOST";
  const result = await makeWorker(repository).runBatch({ now, limit: 1 });
  assert.equal(result.leaseLost, 1);
  assert.equal(repository.rescheduled, null);
}

assert.throws(
  () => new FileRetentionWorker(new FakeRepository(), {
    leaseSeconds: 10,
    maxAttempts: 3,
    retryBaseSeconds: 60,
    retryMaxSeconds: 300,
  }),
  /FILE_RETENTION_WORKER_INVALID_CONFIG/,
);

console.log("FILE_RETENTION_WORKER_PASS");
