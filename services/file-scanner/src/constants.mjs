export const MAX_FILE_BYTES = 52_428_800;
export const MAX_REQUEST_BODY_BYTES = 8_192;

export const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export const RESPONSE_HEADERS = Object.freeze({
  "Cache-Control": "no-store",
  Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff",
  "Content-Type": "application/json",
});
