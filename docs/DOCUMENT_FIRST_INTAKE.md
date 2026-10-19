# iБюро — Document-first client intake

## Product decision

The client workflow starts with uploading documents. Clients are not expected to complete the legacy multi-section questionnaire by manually re-entering information already present in their documents.

The intended workflow is:

1. Client uploads documents to the authenticated case.
2. Existing malware scanning completes. Only files in `READY` state may enter document processing.
3. A private Dockerized processing service extracts text from supported PDFs, images and office documents, then identifies relevant facts.
4. The service stores structured candidate facts with source-file reference, page/region when available, and confidence or review status.
5. The client reviews and corrects only extracted facts that need confirmation; missing facts are asked as short follow-up questions.
6. The application prepares drafts of the исковое заявление, опись имущества and список кредиторов from confirmed case facts.
7. The assigned legal staff member reviews and approves the drafts before they are presented as final or used for filing.

Generated documents are drafts. The service must not file documents with a court or represent an unreviewed draft as legally approved.

## Current implementation boundary

The production portal already has private file upload, malware-scan lifecycle and a separate document list/review lifecycle. Malware scanning establishes whether a file is safe to expose; it does not perform OCR, extract facts or generate legal documents.

An isolated OCR service now exists at `services/document-processor`, and CI builds and inspects its Docker image. A bounded, bearer-authenticated server-to-server TypeScript client now calls its extraction endpoint with redirects disabled and no-store caching. The client is not yet called by the application's file lifecycle, and there is no durable processing queue. The container is not deployed. A typed validator for untrusted fact candidates now defines case/file/page provenance, exact minor-unit money values, confidence bounds and a mandatory `NEEDS_REVIEW` status, but no extractor emits these candidates, they are not persisted or reviewed in the portal, and the three target documents are not generated. The legacy questionnaire remains in the client portal today. Therefore, document-first intake is not release-ready until the gates below are implemented and verified.

## Processing and privacy requirements

- Processing is case-scoped and authenticated; a client, lawyer or manager can only access cases allowed by the existing case authorization rules.
- The OCR/extraction processor is a separate capability from the malware scanner. A malware verdict is never treated as extracted content or as permission to skip document processing.
- The processor accepts only files that completed malware scanning and reached `READY`.
- Original files remain in private storage. The processor receives an authorized short-lived source or an equivalent private stream; no public or long-lived file URL is created.
- Temporary files, page images, OCR text, extracted facts and generated drafts follow an explicit retention and deletion policy.
- Logs and operational health endpoints expose aggregate status only; they must not contain document content, OCR text, extracted personal data, signed URLs or secrets.
- Processing is asynchronous, bounded, idempotent and retryable. Stuck jobs and terminal failures are independently observable.
- Unsupported, unreadable or low-confidence documents are reported clearly and sent for human review. The system must not invent missing facts.
- Each extracted fact retains provenance sufficient for a reviewer to find its source in the uploaded evidence.
- Any external model/provider use requires an explicit privacy, data-location and contract review before client data is sent.

## Release gates

- [ ] Product document types, allowed formats, size/page limits and per-case upload limits approved.
- [ ] Private Dockerized OCR and text-extraction service implemented for the approved formats.
- [ ] Durable, case-scoped processing-job lifecycle implemented, including retry, timeout, idempotency and terminal failure.
- [ ] Processing dispatch is gated on malware-scan status `READY`; quarantined, pending and failed files are never processed.
- [ ] Structured extraction covers debtor identity/contact, income, assets, creditors and debt amounts required by the three target drafts.
- [ ] Candidate facts record source file, source location where available, and confidence/review state.
- [ ] Client review UI lets the client confirm/correct extracted facts and answer only missing or ambiguous questions.
- [ ] The client no longer needs to complete the legacy questionnaire as a prerequisite for preparing the case.
- [ ] Исковое заявление, опись имущества and список кредиторов are generated from confirmed facts using reviewed templates.
- [ ] Legal staff can inspect source evidence, correct case facts, review drafts and approve/reject them; draft status is visible to the client.
- [ ] Access control, audit events, retention/deletion, logs and incident handling are reviewed for the new processing data.
- [ ] Synthetic-document tests cover text PDFs, scanned PDFs, images, supported office files, rotated/low-quality scans, duplicates, malformed files, provider outage and retry.
- [ ] Staging E2E verifies upload -> malware CLEAN/READY -> OCR -> extracted-fact review -> three drafts -> staff review, using synthetic cases and documents only.
- [ ] Operational metrics and alerts cover queued/overdue jobs, processing latency, extraction failures and document-generation failures without exposing personal data.
- [ ] Release checklist and portal navigation are updated so document upload and review are the primary client workflow.

## Implementation note

Do not mark the existing file scanner as OCR-complete. Do not enable real client-document processing until the new gates, privacy review and staging E2E pass.
