import hashlib
import io
import json
from pathlib import Path
import sys
import tempfile
import unittest
from urllib.error import HTTPError, URLError

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from firms_download import DownloadError, download_area, parse_bbox, validate_request

CSV = b"latitude,longitude,acq_date,acq_time,satellite,confidence,frp\n-18.5,-56.5,2025-09-01,0430,Terra,85,12.5\n"
HEADER_ONLY = CSV.splitlines()[0] + b"\n"


class Response(io.BytesIO):
    status = 200


class FirmsDownloadTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.output = Path(self.temp.name) / "download"
        self.key = "test-secret-not-a-real-key"

    def download(self, payload=CSV, **overrides):
        self.calls = []

        def open_request(request, timeout):
            self.calls.append((request.full_url, timeout))
            return Response(payload)

        args = dict(source="MODIS_SP", bbox="-58,-20,-54,-16", start="2025-09-01",
                    days=1, output=self.output, map_key=self.key, opener=open_request)
        args.update(overrides)
        return download_area(**args)

    def test_preserves_original_and_saves_hash_without_key(self):
        result = self.download()
        self.assertEqual((self.output / "detections.csv").read_bytes(), CSV)
        saved = (self.output / "provenance.json").read_text()
        self.assertNotIn(self.key, saved)
        self.assertEqual(json.loads(saved)["sha256"], hashlib.sha256(CSV).hexdigest())
        self.assertEqual(result["row_count"], 1)
        self.assertEqual(result["coverage_status"], "unknown")
        self.assertEqual(result["scientific_status"], "unreviewed")
        self.assertEqual(len(self.calls), 1)
        self.assertTrue(self.calls[0][0].endswith("/MODIS_SP/-58.0,-20.0,-54.0,-16.0/1/2025-09-01"))

    def test_header_only_is_zero_rows_not_zero_fire_or_adequate_coverage(self):
        result = self.download(HEADER_ONLY)
        self.assertEqual(result["row_count"], 0)
        self.assertEqual(result["coverage_status"], "unknown")

    def test_missing_key_does_not_call_network_or_create_files(self):
        with self.assertRaisesRegex(DownloadError, "FIRMS_MAP_KEY"):
            self.download(map_key=None)
        self.assertEqual(self.calls, [])
        self.assertFalse(self.output.exists())

    def test_refuses_overwrite(self):
        self.download()
        with self.assertRaisesRegex(DownloadError, "already exists"):
            self.download()
        self.assertEqual(self.calls, [])

    def test_rejects_html_provider_errors_and_malformed_rows(self):
        for payload in (b"<html>Error</html>", CSV.replace(b"12.5", b"nan"),
                        CSV.replace(b"2025-09-01", b"2025-09-02"),
                        CSV.replace(b"0430", b"2460"), CSV.replace(b"-18.5", b"50"),
                        CSV.replace(b",12.5", b",12.5,extra")):
            with self.subTest(payload=payload):
                with self.assertRaises(DownloadError):
                    self.download(payload)
                self.assertFalse(self.output.exists())

    def test_provider_errors_are_redacted(self):
        for error in (HTTPError(f"https://example.com/{self.key}", 403, self.key, {}, None),
                      URLError(self.key)):
            def fail(request, timeout):
                raise error
            with self.assertRaises(DownloadError) as caught:
                self.download(opener=fail)
            self.assertNotIn(self.key, str(caught.exception))
            self.assertFalse(self.output.exists())

    def test_request_limits_and_bounding_box(self):
        for bbox in ("world", "0,0,1", "1,0,0,1", "-181,-10,1,10", "0,nan,1,10"):
            with self.subTest(bbox=bbox), self.assertRaises(DownloadError):
                parse_bbox(bbox)
        for days in (0, 6):
            with self.assertRaises(DownloadError):
                validate_request("MODIS_SP", "-58,-20,-54,-16", "2025-09-01", days)
        for source, start in (("MODIS_NRT", "2025-09-01"), ("MODIS_SP", "2023-02-29"),
                              ("MODIS_SP", "9999-01-01")):
            with self.assertRaises(DownloadError):
                validate_request(source, "-58,-20,-54,-16", start, 1)

    def test_raw_data_cannot_be_saved_in_frontend(self):
        project = Path(__file__).resolve().parents[2]
        for output in (project / "app" / "public" / "unsafe", project / "dist" / "unsafe"):
            with self.assertRaisesRegex(DownloadError, "cannot be written"):
                self.download(output=output)
            self.assertEqual(self.calls, [])


if __name__ == "__main__":
    unittest.main()


class NegativeRawRetentionTests(unittest.TestCase):
    setUp = FirmsDownloadTests.setUp
    download = FirmsDownloadTests.download

    def test_negative_finite_frp_is_retained_only_with_explicit_audit_policy(self):
        raw=CSV.replace(b"12.5",b"-999")
        with self.assertRaises(DownloadError): self.download(raw)
        report=self.download(raw,retain_negative_frp=True)
        self.assertEqual(report["negative_frp_row_count"],1)
        self.assertEqual(report["raw_frp_policy"],"retain_finite_negative_for_quality_audit")
        self.assertEqual((self.output/"detections.csv").read_bytes(),raw)
        self.assertEqual(report["coverage_status"],"unknown")
