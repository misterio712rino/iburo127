import "server-only";

export const OBJECT_STORAGE_INVALID_KEY = "OBJECT_STORAGE_INVALID_KEY";

export function assertSafeObjectKey(objectKey: string) {
  if (
    !objectKey ||
    objectKey.length > 950 ||
    objectKey.startsWith("/") ||
    objectKey.includes("..") ||
    objectKey.includes("\\") ||
    /[\r\n\0]/.test(objectKey)
  ) {
    throw new Error(OBJECT_STORAGE_INVALID_KEY);
  }
}

export function createStoredFileObjectKey(input: {
  clientCaseId: string;
  fileId: string;
  extension?: string | null;
}) {
  const clientCaseId = input.clientCaseId.trim();
  const fileId = input.fileId.trim();
  if (!/^[0-9a-f-]{36}$/i.test(clientCaseId) || !/^[0-9a-f-]{36}$/i.test(fileId)) {
    throw new Error(OBJECT_STORAGE_INVALID_KEY);
  }

  const extension = input.extension?.trim().toLowerCase();
  if (extension && !/^[a-z0-9]{1,10}$/.test(extension)) {
    throw new Error(OBJECT_STORAGE_INVALID_KEY);
  }

  const objectKey = `cases/${clientCaseId}/${fileId}/object${extension ? `.${extension}` : ""}`;
  assertSafeObjectKey(objectKey);
  return objectKey;
}
