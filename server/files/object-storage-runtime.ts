import "server-only";

import { readYandexObjectStorageConfig } from "@/server/config/production";
import type { PrivateObjectStorage } from "@/server/files/object-storage-contract";
import {
  OBJECT_STORAGE_PROVIDER_CONFIG_ERROR,
  OBJECT_STORAGE_PROVIDER_UNAVAILABLE,
  readPrivateObjectStorageProvider,
  VERCEL_BLOB_STORAGE_PROVIDER,
  type PrivateObjectStorageProvider,
} from "@/server/files/object-storage-provider";
import { YandexPrivateObjectStorage } from "@/server/files/yandex-object-storage";
import { AwsSdkYandexObjectStorageSigner } from "@/server/files/yandex-s3-signer";

let storage: PrivateObjectStorage | undefined;
let storageProvider: PrivateObjectStorageProvider | undefined;

export function getPrivateObjectStorage() {
  const provider = readPrivateObjectStorageProvider();

  if (storage) {
    if (storageProvider !== provider) {
      throw new Error(`${OBJECT_STORAGE_PROVIDER_CONFIG_ERROR}:IB_OBJECT_STORAGE_PROVIDER`);
    }
    return storage;
  }

  if (provider === VERCEL_BLOB_STORAGE_PROVIDER) {
    throw new Error(`${OBJECT_STORAGE_PROVIDER_UNAVAILABLE}:${VERCEL_BLOB_STORAGE_PROVIDER}`);
  }

  const config = readYandexObjectStorageConfig();
  storage = new YandexPrivateObjectStorage(
    config.bucket,
    new AwsSdkYandexObjectStorageSigner(),
  );
  storageProvider = provider;
  return storage;
}
