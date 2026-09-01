export const YANDEX_OBJECT_STORAGE_PROVIDER = "yandex-object-storage";
export const VERCEL_BLOB_STORAGE_PROVIDER = "vercel-blob";
export const OBJECT_STORAGE_PROVIDER_CONFIG_ERROR = "OBJECT_STORAGE_PROVIDER_CONFIG_ERROR";
export const OBJECT_STORAGE_PROVIDER_UNAVAILABLE = "OBJECT_STORAGE_PROVIDER_UNAVAILABLE";

export type PrivateObjectStorageProvider =
  | typeof YANDEX_OBJECT_STORAGE_PROVIDER
  | typeof VERCEL_BLOB_STORAGE_PROVIDER;

type ObjectStorageProviderEnvironment = {
  IB_OBJECT_STORAGE_PROVIDER?: string;
};

export function readPrivateObjectStorageProvider(
  env: ObjectStorageProviderEnvironment = {
    IB_OBJECT_STORAGE_PROVIDER: process.env.IB_OBJECT_STORAGE_PROVIDER,
  },
): PrivateObjectStorageProvider {
  const configured = env.IB_OBJECT_STORAGE_PROVIDER?.trim();
  if (!configured) return YANDEX_OBJECT_STORAGE_PROVIDER;

  if (
    configured === YANDEX_OBJECT_STORAGE_PROVIDER ||
    configured === VERCEL_BLOB_STORAGE_PROVIDER
  ) {
    return configured;
  }

  throw new Error(`${OBJECT_STORAGE_PROVIDER_CONFIG_ERROR}:IB_OBJECT_STORAGE_PROVIDER`);
}
