export type ActivityMetadataValue = string | number | boolean | null;
export type ActivityMetadata = Record<string, ActivityMetadataValue>;

export type CaseActivityRecord = {
  id: string;
  clientCaseId: string;
  actorUserId: string | null;
  type: string;
  metadata: ActivityMetadata | null;
  createdAt: Date;
};

export interface CaseActivityRepository {
  listByCase(clientCaseId: string, limit: number): Promise<readonly CaseActivityRecord[]>;
  append(input: {
    clientCaseId: string;
    actorUserId: string | null;
    type: string;
    metadata?: ActivityMetadata;
  }): Promise<CaseActivityRecord>;
}
