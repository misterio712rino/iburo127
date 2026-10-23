import assert from "node:assert/strict";
import { inferUploadMimeType, UPLOAD_ACCEPT_ATTRIBUTE, UPLOAD_MIME_BY_EXTENSION } from "@/lib/platform/files/upload-types";

assert.deepEqual(
  UPLOAD_ACCEPT_ATTRIBUTE.split(",").map((extension) => extension.slice(1)),
  Object.keys(UPLOAD_MIME_BY_EXTENSION),
  "the file picker must allow every supported extension",
);

for (const [extension, mimeType] of Object.entries(UPLOAD_MIME_BY_EXTENSION)) {
  assert.equal(inferUploadMimeType(`sample.${extension}`, mimeType), mimeType);
  assert.equal(inferUploadMimeType(`sample.${extension}`, ""), mimeType);
  assert.equal(inferUploadMimeType(`sample.${extension}`, "application/octet-stream"), mimeType);
}

assert.equal(inferUploadMimeType("photo.HEIC", ""), "image/heic");
assert.equal(inferUploadMimeType("document.pdf", "application/pdf; charset=binary"), "application/pdf");
assert.equal(inferUploadMimeType("photo.tiff", "image/x-tiff"), "image/tiff");
assert.equal(inferUploadMimeType("creditors.csv", "application/vnd.ms-excel"), "text/csv");
assert.equal(inferUploadMimeType("archive.zip", "application/zip"), null);
assert.equal(inferUploadMimeType("document.docx", "image/jpeg"), null);
assert.equal(inferUploadMimeType("unknown.bin", "application/octet-stream"), null);

console.log("UPLOAD_FORMATS_PASS");
