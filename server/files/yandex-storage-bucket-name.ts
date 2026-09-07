export const YANDEX_STORAGE_BUCKET_NAME_ERROR = "YANDEX_STORAGE_BUCKET_NAME_ERROR";

const IPV4_LIKE_PATTERN = /^(?:\d{1,3}\.){3}\d{1,3}$/;
const BUCKET_LABEL_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

export function isValidYandexStorageBucketName(value: string): boolean {
  if (value.length < 3 || value.length > 63) return false;
  if (IPV4_LIKE_PATTERN.test(value)) return false;

  const labels = value.split(".");
  return labels.every((label) => BUCKET_LABEL_PATTERN.test(label));
}

export function assertValidYandexStorageBucketName(value: string): string {
  if (!isValidYandexStorageBucketName(value)) {
    throw new Error(YANDEX_STORAGE_BUCKET_NAME_ERROR);
  }
  return value;
}
