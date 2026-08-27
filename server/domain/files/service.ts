import type { AuthenticatedActor } from "@/server/domain/client-cases/contracts";
import { ClientCaseService } from "@/server/domain/client-cases/service";
import type { StoredFileRepository } from "@/server/domain/files/contracts";

export const FILE_CASE_NOT_FOUND = "FILE_CASE_NOT_FOUND";
export const FILE_NOT_FOUND = "FILE_NOT_FOUND";
export const FILE_INVALID_METADATA = "FILE_INVALID_METADATA";

function requireText(value: string, maxLength: number) {
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) throw new Error(FILE_INVALID_METADATA);
  return normalized;
}

export class StoredFileService {
  constructor(
    private readonly cases: ClientCaseService,
    private readonly repository: StoredFileRepository,
  ) {}

  private async requireAccessibleCase(actor: AuthenticatedActor, clientCaseId: string) {
    const clientCase = await this.cases.getCase(actor, { caseId: clientCaseId });
    if (!clientCase) throw new Error(FILE_CASE_NOT_FOUND);
    return clientCase;
  }

  async list(actor: AuthenticatedActor, clientCaseId: string) {
    await this.requireAccessibleCase(actor, clientCaseId);
    return this.repository.listByCase(clientCaseId);
  }

  async get(actor: AuthenticatedActor, fileId: string) {
    const file = await this.repository.getById(fileId);
    if (!file) throw new Error(FILE_NOT_FOUND);
    await this.requireAccessibleCase(actor, file.clientCaseId);
    return file;
  }

  async registerTrustedUpload(
    actor: AuthenticatedActor,
    input: {
      clientCaseId: string;
      storageProvider: string;
      objectKey: string;
      fileName: string;
      mimeType: string;
      sizeBytes: bigint;
      checksumSha256?: string | null;
    },
  ) {
    await this.requireAccessibleCase(actor, input.clientCaseId);
    if (input.sizeBytes < BigInt(0)) throw new Error(FILE_INVALID_METADATA);

    return this.repository.create({
      clientCaseId: input.clientCaseId,
      uploadedById: actor.userId,
      storageProvider: requireText(input.storageProvider, 100),
      objectKey: requireText(input.objectKey, 1000),
      fileName: requireText(input.fileName, 500),
      mimeType: requireText(input.mimeType, 200),
      sizeBytes: input.sizeBytes,
      checksumSha256: input.checksumSha256?.trim() || null,
    });
  }
}
