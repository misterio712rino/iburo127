# Private document text extraction service

This container is the first document-first intake building block. It extracts text from PDFs and raster images; it does not identify legal facts, store source files, call an external model, or generate legal documents.

## API

The service is intended for a private application network only. Do not publish port 8080 to the public internet.

- GET /health — bearer-protected dependency readiness.
- POST /v1/extract — bearer-protected raw-body extraction. Content-Type must be application/pdf, image/jpeg, image/png or image/webp.

Successful response:

{"ok":true,"data":{"text":"...","pages":1}}

The caller must send Content-Length and no more than 50 MiB. The service checks content magic bytes against the declared media type. PDFs are limited to 40 pages. PDF text layers are extracted directly; scanned pages are rasterized one at a time and OCRed using Tesseract rus+eng. Requests are serialized to one active processing job; concurrent extraction requests receive 429 PROCESSOR_BUSY.

## Local container

Provide IB_DOCUMENT_PROCESSOR_TOKEN as a secret with at least 32 characters. Do not commit it or pass it as a Docker build argument.

    docker build -t iburo-document-processor:local services/document-processor
    docker run --rm --read-only --tmpfs /tmp:rw,nosuid,nodev,noexec,size=256m -p 127.0.0.1:8080:8080 -e IB_DOCUMENT_PROCESSOR_TOKEN="<local-test-secret>" iburo-document-processor:local

Run contract tests with Python 3.12 or later:

    python -m unittest discover -s services/document-processor/tests -v

## Security boundary

The container does not fetch URLs, so it has no SSRF-capable source URL interface. It does not log request paths, filenames, OCR text, secrets or provider errors. Production must additionally use a private network, read-only filesystem, non-root UID, no-new-privileges, dropped Linux capabilities, bounded CPU/memory/PIDs, and a tmpfs for temporary OCR files. The application must only dispatch files after malware scan status READY and must persist OCR results under case authorization and the retention policy.
