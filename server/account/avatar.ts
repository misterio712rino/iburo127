import "server-only";

import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import type { SessionProvider } from "@/server/auth/contracts";
import { getBetterAuthInstance } from "@/server/auth/better-auth-instance";
import { requireServerActor, UNAUTHENTICATED } from "@/server/auth/runtime";
import { getPrivateObjectStorage } from "@/server/files/object-storage-runtime";

const AVATAR_POINTER_PREFIX = "iburo-avatar:";
const AVATAR_ROOT = "profile-avatars";
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

async function getCurrentAvatarObjectKey() {
  const auth = getBetterAuthInstance();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) throw new Error(UNAUTHENTICATED);

  const image = session.user.image?.trim();
  if (!image?.startsWith(AVATAR_POINTER_PREFIX)) return null;

  const objectKey = image.slice(AVATAR_POINTER_PREFIX.length);
  if (!objectKey.startsWith(avatarPrefixForUser(session.user.id))) return null;
  return objectKey;
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

  const extension = MIME_EXTENSIONS[mimeType];
  const objectKey = `${avatarPrefixForUser(actor.userId)}${randomUUID()}.${extension}`;
  const signed = await getPrivateObjectStorage().createUploadUrl({
    objectKey,
    mimeType,
    sizeBytes: BigInt(sizeBytes),
    expiresInSeconds: 300,
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
  if (!objectKey.startsWith(avatarPrefixForUser(actor.userId))) {
    throw new Error(ACCOUNT_AVATAR_INVALID_INPUT);
  }

  const metadata = await getPrivateObjectStorage().statObject(objectKey);
  if (!metadata) throw new Error(ACCOUNT_AVATAR_NOT_FOUND);
  if (!metadata.mimeType || !isAllowedMimeType(metadata.mimeType) || metadata.sizeBytes > BigInt(MAX_AVATAR_SIZE_BYTES)) {
    await getPrivateObjectStorage().deleteObject(objectKey);
    throw new Error(ACCOUNT_AVATAR_INVALID_INPUT);
  }

  const auth = getBetterAuthInstance();
  await auth.api.updateUser({
    headers: await headers(),
    body: { image: `${AVATAR_POINTER_PREFIX}${objectKey}` },
  });

  return { ok: true } as const;
}
