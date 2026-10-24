from __future__ import annotations

import hmac
import csv
import io
import json
import os
import re
import shutil
import subprocess
import tempfile
import threading
import warnings
import zipfile
from io import BytesIO
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Callable

from PIL import Image, ImageOps, UnidentifiedImageError
from pillow_heif import register_heif_opener

register_heif_opener()
Image.MAX_IMAGE_PIXELS = 40_000_000

MAX_UPLOAD_BYTES = 50 * 1024 * 1024
MAX_PDF_PAGES = 40
MAX_IMAGE_FRAMES = 40
MAX_OFFICE_ZIP_ENTRIES = 20_000
MAX_OFFICE_UNCOMPRESSED_BYTES = 200 * 1024 * 1024
MAX_TEXT_CHARS = 500_000
MAX_PAGE_LINES = 3_000
MAX_TOTAL_LINES = 10_000
MAX_RESPONSE_BYTES = 8 * 1024 * 1024
PROCESS_TIMEOUT_SECONDS = 30
TOKEN_MIN_LENGTH = 32
IMAGE_MIME_TYPES = {
    "image/jpeg", "image/png", "image/webp", "image/gif", "image/bmp",
    "image/tiff", "image/heic", "image/heif", "image/avif",
}
OFFICE_EXTENSIONS = {
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/rtf": "rtf",
    "application/vnd.oasis.opendocument.text": "odt",
    "application/vnd.ms-excel": "xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "application/vnd.oasis.opendocument.spreadsheet": "ods",
    "text/csv": "csv",
    "application/vnd.ms-powerpoint": "ppt",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
    "application/vnd.oasis.opendocument.presentation": "odp",
}
SUPPORTED_MIME_TYPES = {"application/pdf", "text/plain", *IMAGE_MIME_TYPES, *OFFICE_EXTENSIONS}


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
    if data.startswith((b"GIF87a", b"GIF89a")):
        return "image/gif"
    if data.startswith(b"BM"):
        return "image/bmp"
    if data.startswith((b"II*\x00", b"MM\x00*", b"II+\x00", b"MM\x00+")):
        return "image/tiff"
    if len(data) >= 12 and data[4:8] == b"ftyp":
        brand = data[8:12]
        if brand in {b"heic", b"heix", b"hevc", b"hevx", b"mif1", b"msf1"}:
            return "image/heic" if brand in {b"heic", b"heix", b"hevc", b"hevx"} else "image/heif"
        if brand in {b"avif", b"avis"}:
            return "image/avif"
    if data.startswith(b"{\\rtf"):
        return "application/rtf"
    if data.startswith(b"PK\x03\x04"):
        return "application/zip"
    if data.startswith(b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"):
        return "application/x-ole-storage"
    raise ProcessorError("UNSUPPORTED_OR_INVALID_DOCUMENT", 415)


def _run(command: list[str], *, timeout: int, input_bytes: bytes | None = None, env: dict[str, str] | None = None) -> bytes:
    try:
        result = subprocess.run(
            command, input=input_bytes, stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL, check=False, timeout=timeout, env=env,
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


def _bounded_page_texts(values: list[str]) -> list[str]:
    page_texts = [_bounded_text(value) for value in values]
    if sum(map(len, page_texts)) > MAX_TEXT_CHARS:
        raise ProcessorError("EXTRACTED_TEXT_TOO_LARGE", 413)
    return page_texts


def _bounded_page_lines(values: list[list[dict]]) -> list[list[dict]]:
    if len(values) > MAX_PDF_PAGES or sum(map(len, values)) > MAX_TOTAL_LINES:
        raise ProcessorError("EXTRACTED_LAYOUT_TOO_LARGE", 413)
    for page in values:
        if len(page) > MAX_PAGE_LINES:
            raise ProcessorError("EXTRACTED_LAYOUT_TOO_LARGE", 413)
        for line in page:
            if not isinstance(line.get("text"), str) or len(line["text"]) > 2_000:
                raise ProcessorError("INVALID_PROCESSOR_RESULT", 500)
    return values


def _lines_from_text(text: str) -> list[dict]:
    return [
        {"text": line.strip(), "box": None, "confidence": None}
        for line in text.splitlines()
        if line.strip()
    ]


def _parse_tesseract_tsv(tsv: str) -> tuple[str, list[dict]]:
    rows = csv.DictReader(io.StringIO(tsv), delimiter="\t")
    grouped: dict[tuple[str, str, str, str], list[dict]] = {}
    for row in rows:
        if row.get("level") != "5" or not (row.get("text") or "").strip():
            continue
        key = (row.get("page_num", "1"), row.get("block_num", "0"), row.get("par_num", "0"), row.get("line_num", "0"))
        try:
            word = {
                "text": row["text"].strip(),
                "left": int(row["left"]), "top": int(row["top"]),
                "width": int(row["width"]), "height": int(row["height"]),
                "confidence": float(row["conf"]),
            }
        except (KeyError, TypeError, ValueError):
            continue
        if word["confidence"] < 0:
            continue
        grouped.setdefault(key, []).append(word)

    lines: list[dict] = []
    for words in grouped.values():
        left = min(word["left"] for word in words)
        top = min(word["top"] for word in words)
        right = max(word["left"] + word["width"] for word in words)
        bottom = max(word["top"] + word["height"] for word in words)
        lines.append({
            "text": " ".join(word["text"] for word in words),
            "box": {"left": left, "top": top, "width": right - left, "height": bottom - top},
            "confidence": round(sum(word["confidence"] for word in words) / len(words), 1),
        })
    text = "\n".join(line["text"] for line in lines)
    return _bounded_text(text), lines


def _extract_image(data: bytes) -> tuple[list[str], list[list[dict]], int]:
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(BytesIO(data)) as image:
                frames = getattr(image, "n_frames", 1)
                if frames < 1 or frames > MAX_IMAGE_FRAMES:
                    raise ProcessorError("PAGE_LIMIT_EXCEEDED", 413)
                page_texts: list[str] = []
                page_lines: list[list[dict]] = []
                for index in range(frames):
                    image.seek(index)
                    frame = ImageOps.exif_transpose(image.copy()).convert("RGBA")
                    if frame.width * frame.height > Image.MAX_IMAGE_PIXELS:
                        raise ProcessorError("IMAGE_PIXEL_LIMIT_EXCEEDED", 413)
                    background = Image.new("RGBA", frame.size, "white")
                    frame = Image.alpha_composite(background, frame).convert("RGB")
                    converted = BytesIO()
                    frame.save(converted, format="PNG", optimize=True)
                    raw = _run(
                        ["tesseract", "stdin", "stdout", "-l", "rus+eng", "--psm", "3", "tsv"],
                        input_bytes=converted.getvalue(), timeout=PROCESS_TIMEOUT_SECONDS,
                    )
                    text, lines = _parse_tesseract_tsv(raw.decode("utf-8", errors="replace"))
                    page_texts.append(text)
                    page_lines.append(lines)
    except ProcessorError:
        raise
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError, Image.DecompressionBombWarning) as error:
        raise ProcessorError("UNREADABLE_DOCUMENT", 422) from error
    return _bounded_page_texts(page_texts), _bounded_page_lines(page_lines), len(page_texts)


def _validate_office_container(data: bytes, declared_mime_type: str) -> bool:
    if declared_mime_type not in OFFICE_EXTENSIONS:
        return False
    if data.startswith(b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"):
        return declared_mime_type in {
            "application/msword", "application/vnd.ms-excel", "application/vnd.ms-powerpoint",
        }
    if not data.startswith(b"PK\x03\x04"):
        return False
    try:
        with zipfile.ZipFile(BytesIO(data)) as archive:
            entries = archive.infolist()
            if len(entries) > MAX_OFFICE_ZIP_ENTRIES or sum(item.file_size for item in entries) > MAX_OFFICE_UNCOMPRESSED_BYTES:
                raise ProcessorError("OFFICE_ARCHIVE_LIMIT_EXCEEDED", 413)
            names = {item.filename for item in entries}
            if any(item.file_size > MAX_OFFICE_UNCOMPRESSED_BYTES for item in entries):
                return False
            odf_expected = {
                "application/vnd.oasis.opendocument.text": "application/vnd.oasis.opendocument.text",
                "application/vnd.oasis.opendocument.spreadsheet": "application/vnd.oasis.opendocument.spreadsheet",
                "application/vnd.oasis.opendocument.presentation": "application/vnd.oasis.opendocument.presentation",
            }.get(declared_mime_type)
            if odf_expected:
                if "mimetype" not in names or "META-INF/manifest.xml" not in names:
                    return False
                if archive.getinfo("mimetype").file_size > 128 or archive.getinfo("META-INF/manifest.xml").file_size > 1024 * 1024:
                    return False
                return archive.read("mimetype").decode("ascii", errors="ignore").strip() == odf_expected
            if "[Content_Types].xml" not in names:
                return False
            if archive.getinfo("[Content_Types].xml").file_size > 1024 * 1024:
                return False
            manifest = archive.read("[Content_Types].xml")
            roots = {
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "word/",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xl/",
                "application/vnd.openxmlformats-officedocument.presentationml.presentation": "ppt/",
            }
            if declared_mime_type in roots:
                expected_main_type = {
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": b"wordprocessingml.document.main+xml",
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": b"spreadsheetml.sheet.main+xml",
                    "application/vnd.openxmlformats-officedocument.presentationml.presentation": b"presentationml.presentation.main+xml",
                }[declared_mime_type]
                return expected_main_type in manifest and b"macroEnabled" not in manifest and any(name.startswith(roots[declared_mime_type]) for name in names)
            return False
    except ProcessorError:
        raise
    except (OSError, zipfile.BadZipFile, KeyError, RuntimeError):
        return False


def _extract_office(data: bytes, mime_type: str) -> tuple[list[str], list[list[dict]], int]:
    extension = OFFICE_EXTENSIONS[mime_type]
    with tempfile.TemporaryDirectory(prefix="iburo-office-") as directory:
        root = Path(directory)
        source = root / f"input.{extension}"
        source.write_bytes(data)
        output = root / "output"
        output.mkdir()
        profile = root / "profile"
        env = {**os.environ, "HOME": str(root), "SAL_USE_VCLPLUGIN": "svp"}
        _run(
            ["soffice", f"-env:UserInstallation={profile.as_uri()}", "--headless", "--convert-to", "pdf", "--outdir", str(output), str(source)],
            timeout=120, env=env,
        )
        pdf_path = output / "input.pdf"
        if not pdf_path.is_file() or pdf_path.stat().st_size <= 0 or pdf_path.stat().st_size > MAX_UPLOAD_BYTES:
            raise ProcessorError("DOCUMENT_CONVERSION_FAILED", 422)
        return _extract_pdf(pdf_path.read_bytes())


def _decode_text_document(data: bytes) -> str:
    try:
        return data.decode("utf-8-sig")
    except UnicodeDecodeError:
        try:
            return data.decode("utf-16")
        except UnicodeDecodeError as error:
            raise ProcessorError("UNREADABLE_DOCUMENT", 422) from error


def _extract_plain_text(data: bytes) -> tuple[list[str], list[list[dict]], int]:
    text = _decode_text_document(data)
    text = _bounded_text(text)
    lines = _lines_from_text(text)
    return [text], [_bounded_page_lines([lines])[0]], 1


def _extract_pdf(data: bytes) -> tuple[list[str], list[list[dict]], int]:
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

        page_texts: list[str] = []
        page_lines: list[list[dict]] = []
        for page in range(1, page_count + 1):
            embedded = _run(
                ["pdftotext", "-f", str(page), "-l", str(page), "-layout", "-enc",
                 "UTF-8", str(pdf_path), "-"],
                timeout=PROCESS_TIMEOUT_SECONDS,
            ).decode("utf-8", errors="replace")
            embedded = _bounded_text(embedded)
            if len(embedded) >= 24:
                page_texts.append(embedded)
                page_lines.append(_lines_from_text(embedded))
                continue

            prefix = Path(directory) / f"page-{page}"
            _run(
                ["pdftoppm", "-f", str(page), "-l", str(page), "-singlefile",
                 "-scale-to", "2200", "-jpeg", str(pdf_path), str(prefix)],
                timeout=PROCESS_TIMEOUT_SECONDS,
            )
            image_path = prefix.with_suffix(".jpg")
            try:
                raw = _run(
                    ["tesseract", str(image_path), "stdout", "-l", "rus+eng", "--psm", "3", "tsv"],
                    timeout=PROCESS_TIMEOUT_SECONDS,
                )
            finally:
                image_path.unlink(missing_ok=True)
            text, lines = _parse_tesseract_tsv(raw.decode("utf-8", errors="replace"))
            page_texts.append(text)
            page_lines.append(lines)
            if sum(map(len, page_texts)) > MAX_TEXT_CHARS:
                raise ProcessorError("EXTRACTED_TEXT_TOO_LARGE", 413)

        return _bounded_page_texts(page_texts), _bounded_page_lines(page_lines), page_count


def extract_document(data: bytes, declared_mime_type: str) -> tuple[list[str], list[list[dict]], int]:
    if not data or len(data) > MAX_UPLOAD_BYTES:
        raise ProcessorError("INVALID_DOCUMENT_SIZE", 413 if data else 400)
    if declared_mime_type not in SUPPORTED_MIME_TYPES:
        raise ProcessorError("UNSUPPORTED_MEDIA_TYPE", 415)
    try:
        actual = sniff_mime_type(data)
    except ProcessorError:
        if declared_mime_type not in {"text/plain", "text/csv"}:
            raise
        _decode_text_document(data)
        actual = declared_mime_type
    valid_office = actual in {"application/zip", "application/x-ole-storage"} and _validate_office_container(data, declared_mime_type)
    image_alias_match = {actual, declared_mime_type} <= {"image/heic", "image/heif"}
    if actual != declared_mime_type and not image_alias_match and not valid_office:
        raise ProcessorError("DOCUMENT_TYPE_MISMATCH", 415)
    if actual == "application/pdf":
        return _extract_pdf(data)
    if actual in IMAGE_MIME_TYPES or image_alias_match:
        return _extract_image(data)
    if declared_mime_type == "text/plain":
        return _extract_plain_text(data)
    if declared_mime_type == "text/csv":
        return _extract_office(data, declared_mime_type)
    if valid_office or actual == "application/rtf":
        return _extract_office(data, declared_mime_type)
    raise ProcessorError("UNSUPPORTED_OR_INVALID_DOCUMENT", 415)


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
        ready = all(shutil.which(name) for name in ("tesseract", "pdfinfo", "pdftotext", "pdftoppm", "soffice"))
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
            page_texts, page_lines, pages = self.server.processor(data, mime)
            if len(page_texts) != pages or len(page_lines) != pages:
                raise ProcessorError("INVALID_PROCESSOR_RESULT", 500)
            response = json.dumps(
                {"ok": True, "data": {"pageTexts": page_texts, "pageLines": page_lines, "pages": pages}},
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
