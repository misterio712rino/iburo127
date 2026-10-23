# Private document text extraction service

This container extracts text from PDF and common raster, office, spreadsheet, presentation and plain-text files. It does not identify legal facts, store source files, call an external model, or generate legal documents.

## API

The service is intended for a private application network only. Do not publish port 8080 to the public internet.

- GET /health — bearer-protected dependency readiness.
- POST /v1/extract — bearer-protected raw-body extraction. Supported types are PDF; JPEG, PNG, WEBP, GIF, BMP, TIFF, HEIC/HEIF and AVIF images; DOC/DOCX, RTF, ODT; XLS/XLSX, ODS, CSV; PPT/PPTX, ODP; and UTF-8/UTF-16 TXT.

Successful response:

{"ok":true,"data":{"pageTexts":["page 1 text","page 2 text"],"pageLines":[[{"text":"page 1 text","box":{"left":10,"top":20,"width":100,"height":18},"confidence":91.2}],[{"text":"page 2 text","box":null,"confidence":null}]],"pages":2}}

Each `pageTexts` and `pageLines` array item maps to the PDF page with the same one-based position; images return one item. OCR lines include Tesseract word-box bounds and mean confidence. Text-layer PDF lines have `box` and `confidence` set to `null`, because those values are not available from the current PDF text extraction path. The application client keeps page boundaries and line layout available for fact extraction; OCR confidence is a review hint, not proof that a value is correct.

The caller must send Content-Length and no more than 50 MiB. The service checks content signatures/container structure against the declared media type. Office documents are converted to PDF by LibreOffice in a temporary isolated profile; CSV is converted to PDF for readable row/column extraction. PDFs and converted documents are limited to 40 pages. Image inputs are decoded and normalized before OCR; animated/multipage images are handled up to 40 frames, and images above 40 megapixels per frame are rejected. Requests are serialized to one active processing job; concurrent extraction requests receive 429 PROCESSOR_BUSY.

## Local container

Provide IB_DOCUMENT_PROCESSOR_TOKEN as a secret with at least 32 characters. Do not commit it or pass it as a Docker build argument.

    docker build -t iburo-document-processor:local services/document-processor
    docker run --rm --read-only --tmpfs /tmp:rw,nosuid,nodev,noexec,size=256m -p 127.0.0.1:8080:8080 -e IB_DOCUMENT_PROCESSOR_TOKEN="<local-test-secret>" iburo-document-processor:local

Run contract tests with Python 3.12 or later:

    python -m unittest discover -s services/document-processor/tests -v

## Security boundary

The container does not fetch URLs, so it has no SSRF-capable source URL interface. It does not log request paths, filenames, OCR text, secrets or provider errors. Production must additionally use a private network, read-only filesystem, non-root UID, no-new-privileges, dropped Linux capabilities, bounded CPU/memory/PIDs, and a tmpfs for temporary OCR files. The application must only dispatch files after malware scan status READY and must persist OCR results under case authorization and the retention policy.
