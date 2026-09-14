export const FILE_DELETION_HEALTH_INVALID_INPUT = "FILE_DELETION_HEALTH_INVALID_INPUT";

export type StoredFileDeletionHealthSnapshot = {
  overduePending: number;
  expiredLeases: number;
  attentionRequired: number;
  saturated: boolean;
};

export interface StoredFileDeletionHealthRepository {
  inspect(input: {
    overdueBefore: Date;
    limit: number;
  }): Promise<StoredFileDeletionHealthSnapshot>;
}

function requireInteger(value: number, min: number, max: number) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(FILE_DELETION_HEALTH_INVALID_INPUT);
  }
  return value;
}

export class StoredFileDeletionHealthService {
  constructor(private readonly repository: StoredFileDeletionHealthRepository) {}

  async inspect(input: { now: Date; graceMinutes: number; limit: number }) {
    if (!(input.now instanceof Date) || !Number.isFinite(input.now.getTime())) {
      throw new Error(FILE_DELETION_HEALTH_INVALID_INPUT);
    }

    const graceMinutes = requireInteger(input.graceMinutes, 1, 1_440);
    const limit = requireInteger(input.limit, 1, 500);
    const overdueBefore = new Date(input.now.getTime() - graceMinutes * 60_000);
    const snapshot = await this.repository.inspect({ overdueBefore, limit });
    const healthy =
      snapshot.overduePending === 0 &&
      snapshot.expiredLeases === 0 &&
      snapshot.attentionRequired === 0 &&
      !snapshot.saturated;

    return {
      ...snapshot,
      healthy,
      graceMinutes,
      batchLimit: limit,
    };
  }
}
