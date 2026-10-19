from __future__ import annotations

import hmac
import json
import os
import re
import shutil
import subprocess
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Callable

MAX_UPLOAD_BYTES = 50 * 1024 * 1024
MAX_PDF_PAGES = 40
MAX_TEXT_CHARS = 500_000
MAX_RESPONSE_BYTES = 2 * 1024 * 1024
PROCESS_TIMEOUT_SECONDS = 30
TOKEN_MIN_LENGTH = 32
SUPPORTED_MIME_TYPES = {"application/pdf", "image/jpeg", "image/png", "image/webp"}


class ProcessorError(Exception):
    def __init__(self, code: str, status: int):
        super().__init__(code)
        self.code = code
        self.status = status


def sniff_mime_type(data: bytes) -> str:
    if data[:1024].find(b"%PDF-") >= 0:
        return "application/pdf"
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    raise ProcessorError("UNSUPPORTED_OR_INVALID_DOCUMENT", 415)


def _run(command: list[str], *, timeout: int, input_bytes: bytes | None = None) -> bytes:
    try:
        result = subprocess.run(
            command, input=input_bytes, stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL, check=False, timeout=timeout,
        )
    except subprocess.TimeoutExpired as error:
        raise ProcessorError("PROCESSING_TIMEOUT", 504) from error
    except OSError as error:
        raise ProcessorError("PROCESSOR_UNAVAILABLE", 503) from error
    if result.returncode != 0:
        raise ProcessorError("DOCUMENT_PROCESSING_FAILED", 422)
    return result.stdout


def _bounded_text(value: str) -> str:
    text = value.replace("\x00", "").strip()
    if len(text) > MAX_TEXT_CHARS:
        raise ProcessorError("EXTRACTED_TEXT_TOO_LARGE", 413)
    return text


def _extract_image(data: bytes) -> tuple[str, int]:
    raw = _run(
        ["tesseract", "stdin", "stdout", "-l", "rus+eng", "--psm", "3"],
        input_bytes=data, timeout=PROCESS_TIMEOUT_SECONDS,
    )
    return _bounded_text(raw.decode("utf-8", errors="replace")), 1


def _extract_pdf(data: bytes) -> tuple[str, int]:
    with tempfile.TemporaryDirectory(prefix="iburo-doc-") as directory:
        pdf_path = Path(directory) / "input.pdf"
        pdf_path.write_bytes(data)
        info = _run(["pdfinfo", str(pdf_path)], timeout=10).decode("utf-8", errors="replace")
        match = re.search(r"^Pages:\s*(\d+)\s*$", info, flags=re.MULTILINE)
        if not match:
            raise ProcessorError("UNREADABLE_DOCUMENT", 422)
        page_count = int(match.group(1))
        if page_count < 1:
            raise ProcessorError("UNREADABLE_DOCUMENT", 422)
        if page_count > MAX_PDF_PAGES:
            raise ProcessorError("PAGE_LIMIT_EXCEEDED", 413)

        embedded = _run(
            ["pdftotext", "-layout", "-enc", "UTF-8", str(pdf_path), "-"],
            timeout=PROCESS_TIMEOUT_SECONDS,
        ).decode("utf-8", errors="replace")
        embedded = _bounded_text(embedded)
        if len(embedded) >= 24:
            return embedded, page_count

        page_text: list[str] = []
        for page in range(1, page_count + 1):
            prefix = Path(directory) / f"page-{page}"
            _run(
                ["pdftoppm", "-f", str(page), "-l", str(page), "-singlefile",
                 "-scale-to", "2200", "-jpeg", str(pdf_path), str(prefix)],
                timeout=PROCESS_TIMEOUT_SECONDS,
            )
            image_path = prefix.with_suffix(".jpg")
            try:
                raw = _run(
                    ["tesseract", str(image_path), "stdout", "-l", "rus+eng", "--psm", "3"],
                    timeout=PROCESS_TIMEOUT_SECONDS,
                )
            finally:
                image_path.unlink(missing_ok=True)
            page_text.append(raw.decode("utf-8", errors="replace"))
            if sum(map(len, page_text)) > MAX_TEXT_CHARS:
                raise ProcessorError("EXTRACTED_TEXT_TOO_LARGE", 413)
        return _bounded_text("\n\n".join(page_text)), page_count


def extract_document(data: bytes, declared_mime_type: str) -> tuple[str, int]:
    if not data or len(data) > MAX_UPLOAD_BYTES:
        raise ProcessorError("INVALID_DOCUMENT_SIZE", 413 if data else 400)
    if declared_mime_type not in SUPPORTED_MIME_TYPES:
        raise ProcessorError("UNSUPPORTED_MEDIA_TYPE", 415)
    actual = sniff_mime_type(data)
    if actual != declared_mime_type:
        raise ProcessorError("DOCUMENT_TYPE_MISMATCH", 415)
    if actual == "application/pdf":
        return _extract_pdf(data)
    return _extract_image(data)


class ProcessorServer(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True

    def __init__(self, address: tuple[str, int], token: str, processor: Callable = extract_document):
        super().__init__(address, ProcessorHandler)
        self.token = token
        self.processor = processor
        self.processing_slot = threading.BoundedSemaphore(value=1)


class ProcessorHandler(BaseHTTPRequestHandler):
    server: ProcessorServer
    protocol_version = "HTTP/1.1"

    def log_message(self, format: str, *args: object) -> None:
        return

    def _send_json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "private, no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Connection", "close")
        self.close_connection = True
        self.end_headers()
        self.wfile.write(body)

    def _authorized(self) -> bool:
        supplied = self.headers.get("Authorization", "")
        expected = f"Bearer {self.server.token}"
        return hmac.compare_digest(supplied.encode(), expected.encode())

    def do_GET(self) -> None:
        if self.path != "/health":
            self._send_json(404, {"ok": False, "error": {"code": "NOT_FOUND"}})
            return
        if not self._authorized():
            self._send_json(401, {"ok": False, "error": {"code": "UNAUTHORIZED"}})
            return
        ready = all(shutil.which(name) for name in ("tesseract", "pdfinfo", "pdftotext", "pdftoppm"))
        if not ready:
            self._send_json(503, {"ok": False, "error": {"code": "PROCESSOR_UNAVAILABLE"}})
            return
        self._send_json(200, {"ok": True, "data": {"status": "ready"}})

    def do_POST(self) -> None:
        if self.path != "/v1/extract":
            self._send_json(404, {"ok": False, "error": {"code": "NOT_FOUND"}})
            return
        if not self._authorized():
            self._send_json(401, {"ok": False, "error": {"code": "UNAUTHORIZED"}})
            return
        mime = self.headers.get("Content-Type", "").split(";", 1)[0].strip().lower()
        if mime not in SUPPORTED_MIME_TYPES:
            self._send_json(415, {"ok": False, "error": {"code": "UNSUPPORTED_MEDIA_TYPE"}})
            return
        content_length = self.headers.get("Content-Length")
        if not content_length or not content_length.isdecimal():
            self._send_json(411, {"ok": False, "error": {"code": "CONTENT_LENGTH_REQUIRED"}})
            return
        size = int(content_length)
        if size < 1:
            self._send_json(400, {"ok": False, "error": {"code": "INVALID_DOCUMENT_SIZE"}})
            return
        if size > MAX_UPLOAD_BYTES:
            self._send_json(413, {"ok": False, "error": {"code": "INVALID_DOCUMENT_SIZE"}})
            return
        if not self.server.processing_slot.acquire(blocking=False):
            self._send_json(429, {"ok": False, "error": {"code": "PROCESSOR_BUSY"}})
            return

        try:
            self.connection.settimeout(30)
            data = self.rfile.read(size)
            if len(data) != size:
                self._send_json(400, {"ok": False, "error": {"code": "INCOMPLETE_REQUEST_BODY"}})
                return
            text, pages = self.server.processor(data, mime)
            response = json.dumps(
                {"ok": True, "data": {"text": text, "pages": pages}},
                ensure_ascii=False, separators=(",", ":"),
            ).encode("utf-8")
            if len(response) > MAX_RESPONSE_BYTES:
                self._send_json(413, {"ok": False, "error": {"code": "EXTRACTED_TEXT_TOO_LARGE"}})
                return
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(response)))
            self.send_header("Cache-Control", "private, no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Connection", "close")
            self.close_connection = True
            self.end_headers()
            self.wfile.write(response)
        except ProcessorError as error:
            self._send_json(error.status, {"ok": False, "error": {"code": error.code}})
        except (TimeoutError, OSError):
            self._send_json(400, {"ok": False, "error": {"code": "REQUEST_FAILED"}})
        except Exception:
            self._send_json(500, {"ok": False, "error": {"code": "PROCESSING_FAILED"}})
        finally:
            self.server.processing_slot.release()


def main() -> None:
    token = os.environ.get("IB_DOCUMENT_PROCESSOR_TOKEN", "")
    if len(token) < TOKEN_MIN_LENGTH:
        raise SystemExit("IB_DOCUMENT_PROCESSOR_TOKEN must be set to at least 32 characters")
    host = os.environ.get("IB_DOCUMENT_PROCESSOR_HOST", "0.0.0.0")
    port = int(os.environ.get("IB_DOCUMENT_PROCESSOR_PORT", "8080"))
    server = ProcessorServer((host, port), token)
    server.serve_forever(poll_interval=0.5)


if __name__ == "__main__":
    main()
