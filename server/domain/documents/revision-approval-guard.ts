import type { CaseDocumentRevisionRecord } from "@/server/domain/documents/revision-contracts";

export const DOCUMENT_REVISION_ARTIFACT_MISSING = "DOCUMENT_REVISION_ARTIFACT_MISSING";

// A source-data snapshot is not a court document. A future renderer must
// persist an immutable artifact and record its digest before lawyer approval.
// Until then, the review lifecycle must never issue an APPROVED status.
export function assertRenderedArtifactReadyForApproval(
  revision: Pick<CaseDocumentRevisionRecord, "id" | "status" | "sourceDataHash" | "templateSourceHash">,
  artifact: null,
): never {
  void revision;
  void artifact;
  throw new Error(DOCUMENT_REVISION_ARTIFACT_MISSING);
}
