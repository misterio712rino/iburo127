import "server-only";

import { headers } from "next/headers";
import type { SessionProvider } from "@/server/auth/contracts";
import { getBetterAuthInstance } from "@/server/auth/better-auth-instance";
import { requireServerActor, UNAUTHENTICATED } from "@/server/auth/runtime";
import { getPrivateObjectStorage } from "@/server/files/object-storage-runtime";

const AVATAR_POINTER_PREFIX = "iburo-avatar:";
const AVATAR_ROOT = "profile-avatars";
const AVATAR_OBJECT_NAME = "avatar";
const AVATAR_ROUTE = "/api/platform/account/avatar";
const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024;
const MIME_EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

type AllowedAvatarMimeType = keyof typeof MIME_EXTENSIONS;

export const ACCOUNT_AVATAR_INVALID_INPUT = "ACCOUNT_AVATAR_INVALID_INPUT";
export const ACCOUNT_AVATAR_NOT_FOUND = "ACCOUNT_AVATAR_NOT_FOUND";

function isAllowedMimeType(value: string): value is AllowedAvatarMimeType {
  return Object.prototype.hasOwnProperty.call(MIME_EXTENSIONS, value);
}

function avatarPrefixForUser(userId: string) {
  return `${AVATAR_ROOT}/${userId}/`;
}

function avatarObjectKeyForUser(userId: string) {
  return `${avatarPrefixForUser(userId)}${AVATAR_OBJECT_NAME}`;
}

async function getCurrentAvatarObjectKey() {
  const auth = getBetterAuthInstance();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) throw new Error(UNAUTHENTICATED);

  const storage = getPrivateObjectStorage();
  const canonicalObjectKey = avatarObjectKeyForUser(session.user.id);

  try {
    const metadata = await storage.statObject(canonicalObjectKey);
    if (metadata?.mimeType && isAllowedMimeType(metadata.mimeType)) {
      return canonicalObjectKey;
    }
  } catch {
    // Fall through to the legacy Better Auth image pointer for existing avatars.
  }

  const image = session.user.image?.trim();
  if (!image?.startsWith(AVATAR_POINTER_PREFIX)) return null;

  const legacyObjectKey = image.slice(AVATAR_POINTER_PREFIX.length);
  if (!legacyObjectKey.startsWith(avatarPrefixForUser(session.user.id))) return null;
  return legacyObjectKey;
}

export async function getCurrentAccountAvatarUrl(): Promise<string | null> {
  const objectKey = await getCurrentAvatarObjectKey();
  if (!objectKey) return null;

  try {
    const metadata = await getPrivateObjectStorage().statObject(objectKey);
    if (!metadata?.mimeType || !isAllowedMimeType(metadata.mimeType)) return null;
    return AVATAR_ROUTE;
  } catch {
    return null;
  }
}

export async function createCurrentAccountAvatarDownload() {
  const objectKey = await getCurrentAvatarObjectKey();
  if (!objectKey) throw new Error(ACCOUNT_AVATAR_NOT_FOUND);

  const storage = getPrivateObjectStorage();
  const metadata = await storage.statObject(objectKey);
  if (!metadata?.mimeType || !isAllowedMimeType(metadata.mimeType)) {
    throw new Error(ACCOUNT_AVATAR_NOT_FOUND);
  }

  const signed = await storage.createDownloadUrl({
    objectKey,
    expiresInSeconds: 60,
  });
  return {
    url: signed.url,
    mimeType: metadata.mimeType,
  } as const;
}

export async function createCurrentAccountAvatarUpload(
  sessionProvider: SessionProvider,
  input: { mimeType?: unknown; sizeBytes?: unknown },
) {
  const actor = await requireServerActor(sessionProvider);
  const mimeType = typeof input.mimeType === "string" ? input.mimeType.trim().toLowerCase() : "";
  const sizeBytes = typeof input.sizeBytes === "number" ? input.sizeBytes : Number.NaN;

  if (!isAllowedMimeType(mimeType) || !Number.isInteger(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_AVATAR_SIZE_BYTES) {
    throw new Error(ACCOUNT_AVATAR_INVALID_INPUT);
  }

  const objectKey = avatarObjectKeyForUser(actor.userId);
  const signed = await getPrivateObjectStorage().createUploadUrl({
    objectKey,
    mimeType,
    sizeBytes: BigInt(sizeBytes),
    expiresInSeconds: 300,
    allowOverwrite: true,
  });

  return {
    objectKey,
    uploadUrl: signed.url,
    expiresAt: signed.expiresAt.toISOString(),
  };
}

export async function completeCurrentAccountAvatarUpload(
  sessionProvider: SessionProvider,
  objectKeyValue: unknown,
) {
  const actor = await requireServerActor(sessionProvider);
  if (typeof objectKeyValue !== "string") throw new Error(ACCOUNT_AVATAR_INVALID_INPUT);
  const objectKey = objectKeyValue.trim();
  if (objectKey !== avatarObjectKeyForUser(actor.userId)) {
    throw new Error(ACCOUNT_AVATAR_INVALID_INPUT);
  }

  const storage = getPrivateObjectStorage();
  const metadata = await storage.statObject(objectKey);
  if (!metadata) throw new Error(ACCOUNT_AVATAR_NOT_FOUND);
  if (!metadata.mimeType || !isAllowedMimeType(metadata.mimeType) || metadata.sizeBytes > BigInt(MAX_AVATAR_SIZE_BYTES)) {
    await storage.deleteObject(objectKey);
    throw new Error(ACCOUNT_AVATAR_INVALID_INPUT);
  }

  return { ok: true } as const;
}
