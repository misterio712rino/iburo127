import "server-only";

import { readYandexObjectStorageConfig } from "@/server/config/production";
import type { PrivateObjectStorage } from "@/server/files/object-storage-contract";
import { createPrivateObjectStorageForProvider } from "@/server/files/object-storage-factory";
import {
  OBJECT_STORAGE_PROVIDER_CONFIG_ERROR,
  readPrivateObjectStorageProvider,
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

  storage = createPrivateObjectStorageForProvider(provider, {
    createYandex: () => {
      const config = readYandexObjectStorageConfig();
      return new YandexPrivateObjectStorage(
        config.bucket,
        new AwsSdkYandexObjectStorageSigner(),
      );
    },
  });
  storageProvider = provider;
  return storage;
}
