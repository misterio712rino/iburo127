# Release blocker: legacy `CaseDocument.REVIEWED` has no reviewed artifact

Status: OPEN / DO NOT PROMOTE. This document records an observed implementation gap; it does not certify a remediation.

## Evidence at audit HEAD `8946351151faf13cfc97b545e7fcc0e3379f2f05`

- `server/domain/documents/service.ts`: `CaseDocumentService.markReviewed` checks assigned-lawyer access and the aggregate `SENT_FOR_REVIEW` status, then calls `repository.markReviewed` without a rendered document reference or digest.
- `server/repositories/prisma/document-repository.ts`: legacy `markReviewed` persists `CaseDocument.status = REVIEWED` and sends a client notification claiming document review was completed; it does not bind a source revision or PDF/DOCX bytes.
- `server/documents/handlers.ts` and `server/documents/operations.ts`: the legacy review operation remains reachable.
- `components/platform/documents/ProductionDocuments.tsx`: staff still sees `Подтвердить проверку`, and client sees `Проверен` / `Проверка специалистом завершена` on the basis of that aggregate status.

The new `CaseDocumentRevision` flow separately rejects `approve` without an immutable rendered artifact at both service and Prisma-repository layers. The legacy workflow is **not** covered by that new protection.

## Required remediation before real-court-document release

1. Remove misleading client-facing claims and prevent legacy status from being treated as approved, court-ready, or downloadable. Preserve audit history; do not rewrite old records or silently reclassify historical review events.
2. Bind an actual, scan-cleared PDF/DOCX artifact, immutable template identity and source snapshot to a specific revision and digest. Make the lawyer review that exact file. Allow new approved statuses only after successful artifact verification.
3. Replace the legacy review action with the revision-specific action, or explicitly gate the legacy action until the migration is complete. Handle preexisting legacy `REVIEWED` values as metadata-only, not an export entitlement.
4. Test same-case ownership, assigned lawyer, changed questionnaires, stale template, superseded revision, repeated review, and download denial until immutable artifact approval.
5. Apply migration using only the guarded staging Prisma runner, then HTTP/browser QA with synthetic fixtures. Production remains out of scope.

No original court-form DOCX/PDF templates have been supplied yet; do not generate freeform replacement legal text or claim court-ready output.
