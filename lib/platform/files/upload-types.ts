export const UPLOAD_MIME_BY_EXTENSION: Readonly<Record<string, string>> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  jpe: "image/jpeg",
  jfif: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  bmp: "image/bmp",
  dib: "image/bmp",
  tif: "image/tiff",
  tiff: "image/tiff",
  heic: "image/heic",
  heif: "image/heif",
  avif: "image/avif",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  rtf: "application/rtf",
  odt: "application/vnd.oasis.opendocument.text",
  txt: "text/plain",
  csv: "text/csv",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  odp: "application/vnd.oasis.opendocument.presentation",
};

export const UPLOAD_MIME_TYPES = new Set(Object.values(UPLOAD_MIME_BY_EXTENSION));
export const UPLOAD_ACCEPT_ATTRIBUTE = Object.keys(UPLOAD_MIME_BY_EXTENSION)
  .map((extension) => `.${extension}`)
  .join(",");
const MIME_ALIASES: Readonly<Record<string, string>> = {
  "image/x-tiff": "image/tiff",
  "image/x-bmp": "image/bmp",
  "image/x-ms-bmp": "image/bmp",
  "text/rtf": "application/rtf",
  "application/x-rtf": "application/rtf",
};

export function inferUploadMimeType(fileName: string, suppliedMimeType: string): string | null {
  const supplied = suppliedMimeType.trim().toLowerCase().split(";", 1)[0];
  const mimeType = MIME_ALIASES[supplied] ?? supplied;
  const extension = fileName.split(".").pop()?.trim().toLowerCase() ?? "";
  const extensionMimeType = UPLOAD_MIME_BY_EXTENSION[extension];

  if (extensionMimeType && (!mimeType || mimeType === "application/octet-stream" || !UPLOAD_MIME_TYPES.has(mimeType))) {
    return extensionMimeType;
  }
  const compatibleMimePair =
    new Set([mimeType, extensionMimeType]).has("image/heic") && new Set([mimeType, extensionMimeType]).has("image/heif") ||
    extension === "csv" && mimeType === "application/vnd.ms-excel";
  if (mimeType && UPLOAD_MIME_TYPES.has(mimeType) && (mimeType === extensionMimeType || compatibleMimePair)) {
    if (compatibleMimePair && extensionMimeType) return extensionMimeType;
    return extensionMimeType && mimeType !== extensionMimeType ? null : mimeType;
  }
  return null;
}
