import "server-only";

import { randomUUID } from "node:crypto";
import { caseActivityService } from "@/server/activity/runtime";
import type { SessionProvider } from "@/server/auth/contracts";
import { requireServerActor } from "@/server/auth/runtime";
import { createStoredFileObjectKey } from "@/server/files/object-key";
import { getPrivateObjectStorage } from "@/server/files/object-storage-runtime";
import { storedFileService } from "@/server/files/runtime";

export const FILE_UPLOAD_INCOMPLETE = "FILE_UPLOAD_INCOMPLETE";
export const FILE_UPLOAD_METADATA_MISMATCH = "FILE_UPLOAD_METADATA_MISMATCH";
export const FILE_STORAGE_PROVIDER_MISMATCH = "FILE_STORAGE_PROVIDER_MISMATCH";
export const FILE_DELETE_RESTORE_FAILED = "FILE_DELETE_RESTORE_FAILED";

const MIME_EXTENSIONS: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};

export async function listStoredFiles(sessionProvider: SessionProvider, clientCaseId: string) {
  const actor = await requireServerActor(sessionProvider);
  return storedFileService.list(actor, clientCaseId);
}

export async function getStoredFile(sessionProvider: SessionProvider, fileId: string) {
  const actor = await requireServerActor(sessionProvider);
  return storedFileService.get(actor, fileId);
}

export async function prepareStoredFileUpload(
  sessionProvider: SessionProvider,
  input: {
    clientCaseId: string;
    fileName: string;
    mimeType: string;
    sizeBytes: bigint;
  },
) {
  const actor = await requireServerActor(sessionProvider);
  const storage = getPrivateObjectStorage();
  const fileId = randomUUID();
  const objectKey = createStoredFileObjectKey({
    clientCaseId: input.clientCaseId,
    fileId,
    extension: MIME_EXTENSIONS[input.mimeType] ?? null,
  });

  await storedFileService.registerPendingUpload(actor, {
    id: fileId,
    clientCaseId: input.clientCaseId,
    storageProvider: storage.providerCode,
    objectKey,
    fileName: input.fileName,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
  });

  const signed = await storage.createUploadUrl({
    objectKey,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    expiresInSeconds: 300,
  });

  return {
    fileId,
    uploadUrl: signed.url,
    expiresAt: signed.expiresAt,
    requiredHeaders: { "Content-Type": input.mimeType },
  };
}

export async function completeStoredFileUpload(sessionProvider: SessionProvider, fileId: string) {
  const actor = await requireServerActor(sessionProvider);
  const file = await storedFileService.getPendingUpload(actor, fileId);
  const storage = getPrivateObjectStorage();

  if (file.storageProvider !== storage.providerCode) throw new Error(FILE_STORAGE_PROVIDER_MISMATCH);

  const object = await storage.statObject(file.objectKey);
  if (!object) throw new Error(FILE_UPLOAD_INCOMPLETE);

  if (object.sizeBytes !== file.sizeBytes || (object.mimeType && object.mimeType !== file.mimeType)) {
    await storage.deleteObject(file.objectKey);
    throw new Error(FILE_UPLOAD_METADATA_MISMATCH);
  }

  return storedFileService.markUploadPendingScan(actor, file.id);
}

export async function deleteStoredFile(sessionProvider: SessionProvider, fileId: string) {
  const actor = await requireServerActor(sessionProvider);
  const candidate = await storedFileService.getOwnedForDeletion(actor, fileId);
  const storage = getPrivateObjectStorage();

  if (candidate.storageProvider !== storage.providerCode) {
    throw new Error(FILE_STORAGE_PROVIDER_MISMATCH);
  }

  const deleted = await storedFileService.takeOwnedForDeletion(actor, fileId);

  try {
    await storage.deleteObject(deleted.objectKey);
  } catch (error) {
    const restored = await storedFileService.restoreDeleted(deleted);
    if (!restored) throw new Error(FILE_DELETE_RESTORE_FAILED);
    throw error;
  }

  await caseActivityService.appendForActor(actor, {
    clientCaseId: deleted.clientCaseId,
    type: "file.deleted",
    metadata: {
      fileId: deleted.id,
      storageProvider: deleted.storageProvider,
      fileStatus: deleted.status,
    },
  });

  return { fileId: deleted.id };
}

export async function createStoredFileDownloadUrl(
  sessionProvider: SessionProvider,
  fileId: string,
  expiresInSeconds = 120,
) {
  const actor = await requireServerActor(sessionProvider);
  const file = await storedFileService.get(actor, fileId);
  const storage = getPrivateObjectStorage();

  if (file.storageProvider !== storage.providerCode) throw new Error(FILE_STORAGE_PROVIDER_MISMATCH);

  const signed = await storage.createDownloadUrl({
    objectKey: file.objectKey,
    fileName: file.fileName,
    expiresInSeconds,
  });

  await caseActivityService.appendForActor(actor, {
    clientCaseId: file.clientCaseId,
    type: "file.download.authorized",
    metadata: {
      fileId: file.id,
      storageProvider: file.storageProvider,
    },
  });

  return signed;
}
