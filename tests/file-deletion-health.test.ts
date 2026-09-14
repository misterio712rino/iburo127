import assert from "node:assert/strict";
import {
  FILE_DELETION_HEALTH_INVALID_INPUT,
  StoredFileDeletionHealthService,
  type StoredFileDeletionHealthRepository,
} from "../server/domain/files/deletion-health";
import {
  FILE_DELETION_HEALTH_CONFIG_INVALID,
  readStoredFileDeletionHealthConfig,
} from "../server/files/deletion-health-config";

class FakeRepository implements StoredFileDeletionHealthRepository {
  public lastInput: { overdueBefore: Date; limit: number } | null = null;

  constructor(
    private readonly snapshot = {
      overduePending: 0,
      expiredLeases: 0,
      attentionRequired: 0,
      saturated: false,
    },
  ) {}

  async inspect(input: { overdueBefore: Date; limit: number }) {
    this.lastInput = input;
    return this.snapshot;
  }
}

const now = new Date("2026-09-07T00:00:00.000Z");
const healthyRepository = new FakeRepository();
const healthy = await new StoredFileDeletionHealthService(healthyRepository).inspect({
  now,
  graceMinutes: 15,
  limit: 50,
});
assert.equal(healthy.healthy, true);
assert.equal(healthy.graceMinutes, 15);
assert.equal(healthy.batchLimit, 50);
assert.equal(
  healthyRepository.lastInput?.overdueBefore.toISOString(),
  "2026-09-06T23:45:00.000Z",
);

for (const snapshot of [
  { overduePending: 1, expiredLeases: 0, attentionRequired: 0, saturated: false },
  { overduePending: 0, expiredLeases: 1, attentionRequired: 0, saturated: false },
  { overduePending: 0, expiredLeases: 0, attentionRequired: 1, saturated: false },
  { overduePending: 0, expiredLeases: 0, attentionRequired: 0, saturated: true },
]) {
  const result = await new StoredFileDeletionHealthService(new FakeRepository(snapshot)).inspect({
    now,
    graceMinutes: 15,
    limit: 50,
  });
  assert.equal(result.healthy, false);
}

await assert.rejects(
  () =>
    new StoredFileDeletionHealthService(new FakeRepository()).inspect({
      now: new Date("invalid"),
      graceMinutes: 15,
      limit: 50,
    }),
  new RegExp(FILE_DELETION_HEALTH_INVALID_INPUT),
);

assert.deepEqual(readStoredFileDeletionHealthConfig({}), {
  graceMinutes: 15,
  batchLimit: 50,
});
assert.deepEqual(
  readStoredFileDeletionHealthConfig({
    IB_FILE_DELETION_HEALTH_GRACE_MINUTES: "30",
    IB_FILE_DELETION_HEALTH_BATCH_LIMIT: "75",
  }),
  { graceMinutes: 30, batchLimit: 75 },
);
assert.throws(
  () =>
    readStoredFileDeletionHealthConfig({
      IB_FILE_DELETION_HEALTH_GRACE_MINUTES: "0",
    }),
  new RegExp(FILE_DELETION_HEALTH_CONFIG_INVALID),
);
assert.throws(
  () =>
    readStoredFileDeletionHealthConfig({
      IB_FILE_DELETION_HEALTH_BATCH_LIMIT: "501",
    }),
  new RegExp(FILE_DELETION_HEALTH_CONFIG_INVALID),
);

console.log("FILE_DELETION_HEALTH_PASS");
