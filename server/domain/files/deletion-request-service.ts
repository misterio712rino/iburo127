import type { AuthenticatedActor } from "@/server/domain/client-cases/contracts";
import type {
  StoredFileDeletionEnqueueRepository,
  StoredFileDeletionRecord,
} from "@/server/domain/files/deletion-contracts";
import type { StoredFileService } from "@/server/domain/files/service";
import {
  FILE_DELETE_CONFLICT,
  FILE_DELETE_FORBIDDEN,
  FILE_NOT_FOUND,
} from "@/server/domain/files/service";

export const FILE_DELETE_STORAGE_PROVIDER_MISMATCH =
  "FILE_DELETE_STORAGE_PROVIDER_MISMATCH";

export type StoredFileDeletionRequestResult = {
  fileId: string;
  status: StoredFileDeletionRecord["status"];
  requestedAt: Date;
  completedAt: Date | null;
};

type OwnedDeletionCandidateSource = Pick<StoredFileService, "getOwnedForDeletion">;

function requireClientDeleteActor(actor: AuthenticatedActor) {
  const isClient = actor.roles.includes("CLIENT");
  const isStaff = actor.roles.includes("LAWYER") || actor.roles.includes("MANAGER");
  if (!isClient || isStaff) throw new Error(FILE_DELETE_FORBIDDEN);
}

function toRequestResult(deletion: StoredFileDeletionRecord): StoredFileDeletionRequestResult {
  return {
    fileId: deletion.fileId,
    status: deletion.status,
    requestedAt: deletion.requestedAt,
    completedAt: deletion.completedAt,
  };
}

export class StoredFileDeletionRequestService {
  constructor(
    private readonly files: OwnedDeletionCandidateSource,
    private readonly deletions: StoredFileDeletionEnqueueRepository,
    private readonly expectedStorageProvider: string,
  ) {}

  private async existingOwnedDeletion(actor: AuthenticatedActor, fileId: string) {
    const existing = await this.deletions.getByFileId(fileId);
    if (!existing) return null;
    if (existing.requestedByUserId !== actor.userId) throw new Error(FILE_NOT_FOUND);
    return existing;
  }

  async request(
    actor: AuthenticatedActor,
    fileId: string,
    requestedAt = new Date(),
  ): Promise<StoredFileDeletionRequestResult> {
    requireClientDeleteActor(actor);

    const existing = await this.existingOwnedDeletion(actor, fileId);
    if (existing) return toRequestResult(existing);

    let candidate;
    try {
      candidate = await this.files.getOwnedForDeletion(actor, fileId);
    } catch (error) {
      const raced = await this.existingOwnedDeletion(actor, fileId);
      if (raced) return toRequestResult(raced);
      throw error;
    }

    if (candidate.storageProvider !== this.expectedStorageProvider) {
      throw new Error(FILE_DELETE_STORAGE_PROVIDER_MISMATCH);
    }

    const enqueued = await this.deletions.enqueueDeletion({
      fileId: candidate.id,
      clientCaseId: candidate.clientCaseId,
      requestedByUserId: actor.userId,
      storageProvider: candidate.storageProvider,
      objectKey: candidate.objectKey,
      originalFileStatus: candidate.status,
      requestedAt,
    });
    if (enqueued) return toRequestResult(enqueued);

    const raced = await this.existingOwnedDeletion(actor, fileId);
    if (raced) return toRequestResult(raced);
    throw new Error(FILE_DELETE_CONFLICT);
  }
}
