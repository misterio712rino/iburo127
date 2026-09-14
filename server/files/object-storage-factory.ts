import type { PrivateObjectStorage } from "@/server/files/object-storage-contract";
import {
  OBJECT_STORAGE_PROVIDER_CONFIG_ERROR,
  OBJECT_STORAGE_PROVIDER_UNAVAILABLE,
  VERCEL_BLOB_STORAGE_PROVIDER,
  YANDEX_OBJECT_STORAGE_PROVIDER,
  type PrivateObjectStorageProvider,
} from "@/server/files/object-storage-provider";

export type PrivateObjectStorageFactoryDependencies = Readonly<{
  createYandex: () => PrivateObjectStorage;
  createVercelBlob?: () => PrivateObjectStorage;
}>;

function assertProviderMatch(
  provider: PrivateObjectStorageProvider,
  storage: PrivateObjectStorage,
): PrivateObjectStorage {
  if (storage.providerCode !== provider) {
    throw new Error(`${OBJECT_STORAGE_PROVIDER_CONFIG_ERROR}:providerCode`);
  }
  return storage;
}

export function createPrivateObjectStorageForProvider(
  provider: PrivateObjectStorageProvider,
  dependencies: PrivateObjectStorageFactoryDependencies,
): PrivateObjectStorage {
  if (provider === VERCEL_BLOB_STORAGE_PROVIDER) {
    if (!dependencies.createVercelBlob) {
      throw new Error(`${OBJECT_STORAGE_PROVIDER_UNAVAILABLE}:${VERCEL_BLOB_STORAGE_PROVIDER}`);
    }
    return assertProviderMatch(provider, dependencies.createVercelBlob());
  }

  if (provider === YANDEX_OBJECT_STORAGE_PROVIDER) {
    return assertProviderMatch(provider, dependencies.createYandex());
  }

  throw new Error(`${OBJECT_STORAGE_PROVIDER_CONFIG_ERROR}:IB_OBJECT_STORAGE_PROVIDER`);
}
