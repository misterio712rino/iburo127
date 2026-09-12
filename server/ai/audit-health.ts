export type AiAuditHealthRepository = {
  countOrphanedAccepted(input: {
    cutoff: Date;
    limit: number;
  }): Promise<number>;
};

export type AiAuditHealthCheckInput = {
  now: Date;
  graceMinutes: number;
  limit: number;
};

export type AiAuditHealthResult = {
  orphanCount: number;
  saturated: boolean;
  graceMinutes: number;
  batchLimit: number;
};

function assertPositiveInteger(
  value: number,
  label: string,
  min: number,
  max: number,
): number {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`AI_AUDIT_HEALTH_INVALID_CONFIG:${label}`);
  }
  return value;
}

export class AiAuditHealthService {
  constructor(private readonly repository: AiAuditHealthRepository) {}

  async check(input: AiAuditHealthCheckInput): Promise<AiAuditHealthResult> {
    if (!(input.now instanceof Date) || Number.isNaN(input.now.getTime())) {
      throw new Error("AI_AUDIT_HEALTH_INVALID_CONFIG:now");
    }

    const graceMinutes = assertPositiveInteger(input.graceMinutes, "graceMinutes", 2, 1_440);
    const limit = assertPositiveInteger(input.limit, "limit", 1, 200);
    const cutoff = new Date(input.now.getTime() - graceMinutes * 60_000);
    const orphanCount = await this.repository.countOrphanedAccepted({ cutoff, limit });

    if (!Number.isInteger(orphanCount) || orphanCount < 0 || orphanCount > limit) {
      throw new Error("AI_AUDIT_HEALTH_INVALID_RESULT");
    }

    return {
      orphanCount,
      saturated: orphanCount === limit,
      graceMinutes,
      batchLimit: limit,
    };
  }
}
