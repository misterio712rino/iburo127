import { SafeScannerError } from "./errors.mjs";

const VERCEL_SUFFIX = ".private.blob.vercel-storage.com";
const VERCEL_STORE_ID = /^[A-Za-z0-9_-]{3,128}$/;
const YANDEX_BUCKET = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;

function hasOneNonEmpty(params, name) {
  const values = params.getAll(name);
  return values.length === 1 && values[0].length > 0;
}

function isYandexHostname(hostname) {
  if (hostname === "storage.yandexcloud.net") return true;
  const suffix = ".storage.yandexcloud.net";
  if (!hostname.endsWith(suffix)) return false;
  return YANDEX_BUCKET.test(hostname.slice(0, -suffix.length));
}

function isVercelHostname(hostname) {
  if (!hostname.endsWith(VERCEL_SUFFIX)) return false;
  return VERCEL_STORE_ID.test(hostname.slice(0, -VERCEL_SUFFIX.length));
}

export function assertTrustedSourceUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new SafeScannerError("SOURCE_URL_REJECTED", 400);
  }
  const afterScheme = value.slice("https://".length);
  const authorityEnd = afterScheme.search(/[/?#]/);
  const authority = afterScheme.slice(0, authorityEnd === -1 ? undefined : authorityEnd);
  if (
    url.protocol !== "https:" ||
    authority.toLowerCase() !== url.hostname ||
    url.username ||
    url.password ||
    url.port ||
    url.hash ||
    url.pathname === "/"
  ) {
    throw new SafeScannerError("SOURCE_URL_REJECTED", 400);
  }
  if (isYandexHostname(url.hostname)) {
    if (!hasOneNonEmpty(url.searchParams, "X-Amz-Signature")) {
      throw new SafeScannerError("SOURCE_URL_REJECTED", 400);
    }
    return url;
  }
  if (
    isVercelHostname(url.hostname) &&
    hasOneNonEmpty(url.searchParams, "vercel-blob-delegation") &&
    hasOneNonEmpty(url.searchParams, "vercel-blob-signature")
  ) {
    return url;
  }
  throw new SafeScannerError("SOURCE_URL_REJECTED", 400);
}
