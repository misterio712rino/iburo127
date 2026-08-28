import "server-only";

import { readYandexObjectStorageConfig } from "@/server/config/production";
import {
  YandexPrivateObjectStorage,
} from "@/server/files/yandex-object-storage";
import { AwsSdkYandexObjectStorageSigner } from "@/server/files/yandex-s3-signer";

let storage: YandexPrivateObjectStorage | undefined;

export function getPrivateObjectStorage() {
  if (storage) return storage;

  const config = readYandexObjectStorageConfig();
  storage = new YandexPrivateObjectStorage(
    config.bucket,
    new AwsSdkYandexObjectStorageSigner(),
  );
  return storage;
}
