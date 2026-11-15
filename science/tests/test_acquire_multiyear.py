from pathlib import Path
import json
import sys
import tempfile
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from acquire_multiyear import acquire
from firms_download import DownloadError, ENDPOINT
from normalize_detections import file_hash


def fake_download(**kw):
    root = kw["output"]; root.mkdir(parents=True)
    text = "latitude,longitude,acq_date,acq_time,satellite,confidence,frp\n"
    (root / "detections.csv").write_text(text)
    from datetime import date, timedelta
    meta = {"source":kw["source"],"bbox":[-60.,-23.,-54.,-15.],"requested_start_utc":kw["start"],
            "requested_end_utc_inclusive":(date.fromisoformat(kw["start"])+timedelta(days=kw["days"]-1)).isoformat(),
            "endpoint":ENDPOINT,"processing_level":"SP","sha256":file_hash(root/"detections.csv"),
            "bytes":len(text.encode()),"row_count":0,"retrieved_at_utc":"2026-11-15T00:00:00Z"}
    (root/"provenance.json").write_text(json.dumps(meta))
    return meta


class ResumableAcquisitionTests(unittest.TestCase):
    def test_resume_revalidates_and_spends_no_requests_on_cached_items(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp)
            first=acquire(root=root,max_new_requests=2,downloader=fake_download,sleep=lambda _:None)
            self.assertEqual(first["completed_requests"],2)
            second=acquire(root=root,max_new_requests=0,downloader=lambda **_:self.fail("No network"))
            self.assertEqual(second["completed_requests"],2)
            self.assertEqual(second["new_request_attempts"],0)
            third=acquire(root=root,max_new_requests=1,downloader=fake_download,sleep=lambda _:None)
            self.assertEqual(third["completed_requests"],3)

    def test_corruption_fails_before_any_new_request(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp)
            report=acquire(root=root,max_new_requests=1,downloader=fake_download,sleep=lambda _:None)
            (root/"raw"/report["requests"][0]["id"]/"detections.csv").write_text("changed")
            with self.assertRaises(ValueError):
                acquire(root=root,max_new_requests=1,downloader=lambda **_:self.fail("No network"))

    def test_failures_are_bounded_and_do_not_leak_exceptions(self):
        with tempfile.TemporaryDirectory() as temp:
            def fail(**_): raise DownloadError("secret-url-should-not-be-saved")
            root=Path(temp)
            report=acquire(root=root,max_new_requests=2,downloader=fail,sleep=lambda _:None)
            self.assertEqual(report["new_request_attempts"],2)
            self.assertFalse(report["complete"])
            self.assertNotIn("secret-url",(root/"manifest.json").read_text())
            self.assertEqual(len(report["failures"]),1)

    def test_plan_and_request_metadata_are_bound_to_cache(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp)
            report=acquire(root=root,max_new_requests=1,downloader=fake_download,sleep=lambda _:None)
            path=root/"raw"/report["requests"][0]["id"]/"provenance.json"
            meta=json.loads(path.read_text());meta["source"]="VIIRS_SNPP_SP";path.write_text(json.dumps(meta))
            with self.assertRaises(ValueError): acquire(root=root,max_new_requests=0)


    def test_legacy_cache_upgrade_preserves_original_files_without_network(self):
        from acquisition_plan import build_plan
        with tempfile.TemporaryDirectory() as temporary:
            root=Path(temporary);old=build_plan(legacy=True)
            (root/"plan.json").write_text(json.dumps(old))
            request=old["requests"][0]
            fake_download(source=request["source"],start=request["start"],days=request["days"],output=root/"raw"/request["id"])
            before=file_hash(root/"raw"/request["id"]/"detections.csv")
            report=acquire(root=root,max_new_requests=0,downloader=lambda **_:self.fail("No new requests"))
            self.assertEqual(report["planned_requests"],1012)
            self.assertEqual(report["completed_requests"],1)
            self.assertEqual(json.loads((root/"plan.v1.0.json").read_text()),old)
            self.assertTrue(json.loads((root/"plan-upgrade-receipt.json").read_text())["original_requests_unchanged"])
            self.assertEqual(before,file_hash(root/"raw"/request["id"]/"detections.csv"))
