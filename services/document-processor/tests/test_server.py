import http.client
import json
import sys
import threading
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from server import MAX_UPLOAD_BYTES, ProcessorError, ProcessorServer, extract_document, sniff_mime_type


TOKEN = "test-token-with-at-least-thirty-two-characters"


class DocumentTypeTests(unittest.TestCase):
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
            return "Распознанный текст для проверки", 1

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
        self.assertEqual(payload["data"]["text"], "Распознанный текст для проверки")
        self.assertEqual(payload["data"]["pages"], 1)
        self.assertEqual(response.getheader("Cache-Control"), "private, no-store")
        connection.close()

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
