import "server-only";

import { readYandexObjectStorageConfig } from "@/server/config/production";
import type { PrivateObjectStorage } from "@/server/files/object-storage-contract";
import { createPrivateObjectStorageForProvider } from "@/server/files/object-storage-factory";
import {
  OBJECT_STORAGE_PROVIDER_CONFIG_ERROR,
  readPrivateObjectStorageProvider,
  type PrivateObjectStorageProvider,
} from "@/server/files/object-storage-provider";
import { inferStagingVercelBlobProvider } from "@/server/files/vercel-preview-storage-provider";
import { readVercelBlobAuthConfig } from "@/server/files/vercel-blob-config";
import { toVercelBlobSdkCredentialOptions } from "@/server/files/vercel-blob-driver-auth";
import { createVercelBlobNativeSignedUrlDependencies } from "@/server/files/vercel-blob-native-signed-url";
import { VercelBlobPrivateObjectStorage } from "@/server/files/vercel-blob-object-storage";
import { createVercelBlobSignedUrlDriver } from "@/server/files/vercel-blob-signed-url-driver";
import { YandexPrivateObjectStorage } from "@/server/files/yandex-object-storage";
import { AwsSdkYandexObjectStorageSigner } from "@/server/files/yandex-s3-signer";

let storage: PrivateObjectStorage | undefined;
let storageProvider: PrivateObjectStorageProvider | undefined;

function selectedProvider(): PrivateObjectStorageProvider {
  const inferred = inferStagingVercelBlobProvider(process.env);
  if (inferred) return inferred;
  return readPrivateObjectStorageProvider();
}

export function getPrivateObjectStorage() {
  const provider = selectedProvider();

  if (storage) {
    if (storageProvider !== provider) {
      throw new Error(`${OBJECT_STORAGE_PROVIDER_CONFIG_ERROR}:IB_OBJECT_STORAGE_PROVIDER`);
    }
    return storage;
  }

  storage = createPrivateObjectStorageForProvider(provider, {
    createVercelBlob: () => {
      const credentials = toVercelBlobSdkCredentialOptions(readVercelBlobAuthConfig());
      const driver = createVercelBlobSignedUrlDriver(
        createVercelBlobNativeSignedUrlDependencies(),
        credentials,
      );
      return new VercelBlobPrivateObjectStorage(driver);
    },
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
