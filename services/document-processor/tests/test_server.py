import http.client
import json
import sys
import threading
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from server import MAX_UPLOAD_BYTES, ProcessorError, ProcessorServer, _extract_pdf, _parse_tesseract_tsv, extract_document, sniff_mime_type


TOKEN = "test-token-with-at-least-thirty-two-characters"
TSV_HEADER = "level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext\n"


class DocumentTypeTests(unittest.TestCase):
    def test_pdf_text_is_returned_with_page_boundaries(self):
        def fake_run(command, **kwargs):
            if command[0] == "pdfinfo":
                return b"Pages: 2\n"
            if command[0] == "pdftotext":
                page = command[command.index("-f") + 1]
                if page == "1":
                    return b"Page one embedded text with enough characters."
                return b""
            if command[0] == "pdftoppm":
                Path(command[-1] + ".jpg").write_bytes(b"image")
                return b""
            if command[0] == "tesseract":
                return (TSV_HEADER +
                    "5\t1\t1\t1\t1\t1\t10\t20\t40\t12\t92.0\tPage\n" +
                    "5\t1\t1\t1\t1\t2\t55\t20\t25\t12\t88.0\ttwo\n" +
                    "5\t1\t1\t1\t1\t3\t85\t20\t45\t12\t90.0\tscanned\n" +
                    "5\t1\t1\t1\t1\t4\t135\t20\t30\t12\t86.0\ttext.\n").encode()
            raise AssertionError(command[0])

        with patch("server._run", side_effect=fake_run):
            page_texts, page_lines, pages = _extract_pdf(b"%PDF-1.7 synthetic")

        self.assertEqual(pages, 2)
        self.assertEqual(page_texts, [
            "Page one embedded text with enough characters.",
            "Page two scanned text.",
        ])
        self.assertEqual(page_lines[0], [{
            "text": "Page one embedded text with enough characters.",
            "box": None,
            "confidence": None,
        }])
        self.assertEqual(page_lines[1][0]["text"], "Page two scanned text.")
        self.assertEqual(page_lines[1][0]["box"], {"left": 10, "top": 20, "width": 155, "height": 12})
        self.assertEqual(page_lines[1][0]["confidence"], 89.0)

    def test_tesseract_tsv_is_grouped_into_lines_with_bounds(self):
        text, lines = _parse_tesseract_tsv(
            TSV_HEADER +
            "5\t1\t1\t1\t1\t1\t10\t20\t40\t12\t92.0\tФИО:\n" +
            "5\t1\t1\t1\t1\t2\t55\t20\t35\t12\t88.0\tИванов\n" +
            "5\t1\t1\t1\t2\t1\t10\t40\t80\t12\t91.0\tСтраница\n"
        )
        self.assertEqual(text, "ФИО: Иванов\nСтраница")
        self.assertEqual(len(lines), 2)
        self.assertEqual(lines[0]["box"], {"left": 10, "top": 20, "width": 80, "height": 12})

    def test_detects_supported_magic_bytes(self):
        self.assertEqual(sniff_mime_type(b"%PDF-1.7 test"), "application/pdf")
        self.assertEqual(sniff_mime_type(b"\xff\xd8\xffimage"), "image/jpeg")
        self.assertEqual(sniff_mime_type(b"\x89PNG\r\n\x1a\nimage"), "image/png")
        self.assertEqual(sniff_mime_type(b"RIFFxxxxWEBPimage"), "image/webp")

    def test_rejects_unknown_type(self):
        with self.assertRaises(ProcessorError) as caught:
            sniff_mime_type(b"not a document")
        self.assertEqual(caught.exception.code, "UNSUPPORTED_OR_INVALID_DOCUMENT")

    def test_declared_type_must_match_content(self):
        with self.assertRaises(ProcessorError) as caught:
            extract_document(b"%PDF-1.7 test", "image/png")
        self.assertEqual(caught.exception.code, "DOCUMENT_TYPE_MISMATCH")

    def test_unsupported_declared_type_is_rejected(self):
        with self.assertRaises(ProcessorError) as caught:
            extract_document(b"word", "application/msword")
        self.assertEqual(caught.exception.code, "UNSUPPORTED_MEDIA_TYPE")


class ApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        def fake_processor(data, mime_type):
            return ["Распознанный текст для проверки"], [[{
                "text": "Распознанный текст для проверки",
                "box": {"left": 1, "top": 2, "width": 10, "height": 4},
                "confidence": 91.0,
            }]], 1

        cls.server = ProcessorServer(("127.0.0.1", 0), TOKEN, processor=fake_processor)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.port = cls.server.server_address[1]

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=2)

    def request(self, method, path, headers=None, body=None):
        connection = http.client.HTTPConnection("127.0.0.1", self.port, timeout=3)
        connection.request(method, path, body=body, headers=headers or {})
        response = connection.getresponse()
        payload = json.loads(response.read().decode("utf-8"))
        connection.close()
        return response.status, payload

    def test_health_requires_internal_token(self):
        status, payload = self.request("GET", "/health")
        self.assertEqual(status, 401)
        self.assertEqual(payload["error"]["code"], "UNAUTHORIZED")

    def test_extract_returns_no_store_response(self):
        connection = http.client.HTTPConnection("127.0.0.1", self.port, timeout=3)
        connection.request(
            "POST", "/v1/extract",
            body=b"\xff\xd8\xffimage",
            headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "image/jpeg"},
        )
        response = connection.getresponse()
        payload = json.loads(response.read().decode("utf-8"))
        self.assertEqual(response.status, 200)
        self.assertEqual(payload["data"]["pageTexts"], ["Распознанный текст для проверки"])
        self.assertEqual(payload["data"]["pageLines"][0][0]["confidence"], 91.0)
        self.assertEqual(payload["data"]["pages"], 1)
        self.assertEqual(response.getheader("Cache-Control"), "private, no-store")
        connection.close()

    def test_extract_accepts_text_and_layout_near_the_character_limit(self):
        text = "я" * 500_000
        original_processor = self.server.processor
        self.server.processor = lambda _data, _mime: ([text], [[{
            "text": text,
            "box": {"left": 1, "top": 2, "width": 10, "height": 4},
            "confidence": 91.0,
        }]], 1)
        connection = http.client.HTTPConnection("127.0.0.1", self.port, timeout=10)
        connection.request(
            "POST", "/v1/extract",
            body=b"\xff\xd8\xffimage",
            headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "image/jpeg"},
        )
        response = connection.getresponse()
        payload = json.loads(response.read().decode("utf-8"))
        self.assertEqual(response.status, 200)
        self.assertEqual(len(payload["data"]["pageTexts"][0]), 500_000)
        self.assertEqual(len(payload["data"]["pageLines"][0][0]["text"]), 500_000)
        connection.close()
        self.server.processor = original_processor

    def test_extract_requires_internal_token(self):
        status, payload = self.request(
            "POST", "/v1/extract",
            headers={"Content-Type": "image/jpeg"},
            body=b"image",
        )
        self.assertEqual(status, 401)
        self.assertEqual(payload["error"]["code"], "UNAUTHORIZED")

    def test_declared_oversize_body_is_rejected_before_read(self):
        connection = http.client.HTTPConnection("127.0.0.1", self.port, timeout=3)
        connection.putrequest("POST", "/v1/extract")
        connection.putheader("Authorization", f"Bearer {TOKEN}")
        connection.putheader("Content-Type", "image/jpeg")
        connection.putheader("Content-Length", str(MAX_UPLOAD_BYTES + 1))
        connection.endheaders()
        response = connection.getresponse()
        payload = json.loads(response.read().decode("utf-8"))
        self.assertEqual(response.status, 413)
        self.assertEqual(payload["error"]["code"], "INVALID_DOCUMENT_SIZE")
        connection.close()

    def test_wrong_content_type_is_rejected_without_processing(self):
        status, payload = self.request(
            "POST", "/v1/extract",
            headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/msword"},
            body=b"word",
        )
        self.assertEqual(status, 415)
        self.assertEqual(payload["error"]["code"], "UNSUPPORTED_MEDIA_TYPE")

    def test_unknown_route_is_not_exposed(self):
        status, payload = self.request("GET", "/internal/details")
        self.assertEqual(status, 404)
        self.assertEqual(payload["error"]["code"], "NOT_FOUND")


if __name__ == "__main__":
    unittest.main()
