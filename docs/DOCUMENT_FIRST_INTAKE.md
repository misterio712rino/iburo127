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

The production portal has private file upload and malware scanning. In the OCR branch, a clean `READY` transition enqueues a durable case-scoped processing job; a bounded worker reads the private object and sends supported PDFs, images, office documents, spreadsheets, presentations and plain-text files to the bearer-authenticated Docker service. The worker stores page text in the job record and supports leases, retries and terminal failure. The maintenance workflow is opt-in and must be verified as enabled in the target environment.

The client file page now has a private status endpoint and displays malware-scan/OCR job states without returning page text to the browser. The OCR service returns page text plus line-level boxes and Tesseract confidence for scanned pages; text-layer PDF lines have no coordinates or OCR confidence. A conservative rule-based extractor recognizes explicitly labeled full name, birth date, monthly income, overall debt, limited creditor rows, and numbered property rows. For scanned lines only, it can associate a small set of exact labels (full name, birth date, monthly income, overall debt) with a nearby, format-valid value on the same row or directly below; if the geometry has multiple plausible values, it skips the association. It does not infer meaning from arbitrary unlabeled text or general tables. Per-creditor amounts are not split into principal, interest, overdue amount, or penalties. During OCR completion, candidate facts are saved atomically with the processing job in a case/file-scoped table; they retain page number and confidence, and all start in `NEEDS_REVIEW`. A client-owner-only endpoint and review panel allow values to be corrected, confirmed or rejected; edits retain the original value type and are validated server-side. The documents page now provides a separate preview summary for the bankruptcy application, property inventory, and creditor list from confirmed facts only, with source filename/page references. The summary is explicitly not a court-ready document; the existing document status workflow remains questionnaire-based, and confirmed facts do not yet produce rendered DOCX/PDF files or populate that workflow. The revision service still has no active template registry, so template-backed output is not available. Extraction coverage remains a prototype and does not cover full identity/contact details, broad document layouts, or all creditor and property fields. The visible staging page inspected on 2026-10-20 still showed the questionnaire-driven flow; the updated status UI is in the OCR feature branch and has not been verified on staging.

Therefore, this work advances the document-first intake foundation, but does not complete the promised workflow or make the application release-ready. The remaining gates below must be implemented and verified before describing the app as automatically preparing documents from uploads.

See [DOCUMENT_FIRST_FACT_CATALOG.md](./DOCUMENT_FIRST_FACT_CATALOG.md) for the draft crosswalk between current intake fields, candidate facts, and the three planned outputs. The catalog is not a legal checklist; product and insolvency counsel must approve it before it drives extraction or templates.

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
- [x] Private Dockerized OCR and text-extraction service implemented for PDF and image inputs; broader format approval remains open.
- [x] Durable, case-scoped processing-job lifecycle implemented, including retry, timeout, idempotency and terminal failure.
- [x] Processing dispatch is gated on malware-scan status `READY`; quarantined, pending and failed files are never processed.
- [ ] Structured extraction covers debtor identity/contact, income, assets, creditors and debt amounts required by the three target drafts.
- [ ] Candidate facts record source file, source location where available, and confidence/review state. A first limited set is persisted; coverage and reviewer workflow remain incomplete.
- [ ] Client review UI lets the client confirm/correct extracted facts and answer only missing or ambiguous questions. Correction/confirmation is implemented for a small initial field set; broader extraction and missing-field follow-up remain open.
- [ ] The client no longer needs to complete the legacy questionnaire as a prerequisite for preparing the case.
- [ ] Исковое заявление, опись имущества and список кредиторов are generated from confirmed facts using reviewed templates.
- [ ] Legal staff can inspect source evidence, correct case facts, review drafts and approve/reject them; draft status is visible to the client.
- [ ] Access control, audit events, retention/deletion, logs and incident handling are reviewed for the new processing data.
- [ ] Synthetic-document tests cover text PDFs, scanned PDFs, images, supported office files, rotated/low-quality scans, duplicates, malformed files, provider outage and retry.
- [ ] Staging E2E verifies upload -> malware CLEAN/READY -> OCR -> extracted-fact review -> three drafts -> staff review, using synthetic cases and documents only. Browser inspection on 2026-10-20 confirmed the staging page still exposes the legacy questionnaire-driven drafts; an actual file upload was not performed.
- [ ] Operational metrics and alerts cover queued/overdue jobs, processing latency, extraction failures and document-generation failures without exposing personal data.
- [ ] Release checklist and portal navigation are updated so document upload and review are the primary client workflow.

## Implementation note

Do not mark the existing file scanner as OCR-complete. Do not enable real client-document processing until the new gates, privacy review and staging E2E pass.
