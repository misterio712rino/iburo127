import { createHash } from "node:crypto";
import {
  DOCUMENT_REVISION_INVALID_SOURCE,
  type DocumentSourceValue,
} from "@/server/domain/documents/revision-contracts";

function canonicalize(value: DocumentSourceValue): string {
  if (value === null || typeof value === "boolean" || typeof value === "number") {
    if (typeof value === "number" && !Number.isFinite(value)) {
      throw new Error(DOCUMENT_REVISION_INVALID_SOURCE);
    }
    return JSON.stringify(value);
  }

  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;

  const entries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
  return `{${entries
    .map(([key, entryValue]) => `${JSON.stringify(key)}:${canonicalize(entryValue)}`)
    .join(",")}}`;
}

export function hashDocumentSource(value: DocumentSourceValue) {
  const canonical = canonicalize(value);
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

export function assertSha256(value: string) {
  if (!/^[a-f0-9]{64}$/.test(value)) {
    throw new Error(DOCUMENT_REVISION_INVALID_SOURCE);
  }
  return value;
}
