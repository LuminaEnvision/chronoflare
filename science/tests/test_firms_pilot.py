import csv
from datetime import date, timedelta
import hashlib
import json
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from firms_download import DownloadError
from firms_pilot import compare_records, daily_audit, load_reference, plan, run_pilot
from normalize_detections import NormalizationError

REFERENCE = Path(__file__).resolve().parents[2] / "app/public/data/detection-review/v1"


def record(**changes):
    return {"acquired_at_utc": "2020-08-10T03:45:00Z", "satellite": "Terra",
            "longitude": -57, "latitude": -18, "frp_mw": 11.7,
            "confidence_raw": "90", "source_type": "0", **changes}


class FirmsPilotTests(unittest.TestCase):
    def test_plan_covers_each_date_once_per_source(self):
        requests = plan()
        self.assertEqual(len(requests), 6)
        for source in ("MODIS_SP", "VIIRS_SNPP_SP"):
            dates = [date.fromisoformat(item["start"]) + timedelta(days=day)
                     for item in requests if item["source"] == source for day in range(item["days"])]
            self.assertEqual(dates, [date(2020, 8, day) for day in range(1, 16)])

    def test_multiset_preserves_duplicate_differences(self):
        result = compare_records([record()], [record(), record()], "modis")
        self.assertFalse(result["shared_fields_equal"])
        self.assertEqual(result["reference_only_occurrences"], 1)
        self.assertEqual(result["reference_duplicate_shared_field_occurrences"], 1)
        changed = compare_records([record(frp_mw=12)], [record()], "modis")
        self.assertEqual(changed["shared_field_matches"], 0)

    def test_equivalent_numeric_and_confidence_forms(self):
        self.assertTrue(compare_records([record(confidence_raw="90.0")], [record()], "modis")["shared_fields_equal"])
        self.assertTrue(compare_records([record(confidence_raw="nominal")], [record(confidence_raw="n")], "viirs")["shared_fields_equal"])

    def test_missing_type_does_not_claim_full_equality(self):
        result = compare_records([record(source_type=None)], [record()], "modis")
        self.assertTrue(result["shared_fields_equal"])
        self.assertIsNone(result["including_source_type_equal"])
        self.assertFalse(compare_records([record(source_type="1")], [record()], "modis")["including_source_type_equal"])

    def test_solar_dates_missing_background_and_edges(self):
        rows = daily_audit([record(), record(frp_mw=0)], ["Terra", "Aqua"])
        day = next(row for row in rows if row["solar_date"] == "2020-08-09" and row["platform"] == "Terra")
        self.assertEqual(day["positive_detection_count"], 2)
        self.assertEqual(day["raw_frp_sum_mw"], 11.7)
        self.assertTrue(day["request_contains_complete_solar_day"])
        empty = next(row for row in rows if row["solar_date"] == "2020-08-09" and row["platform"] == "Aqua")
        self.assertIsNone(empty["positive_detection_count"])
        self.assertIsNone(empty["raw_frp_sum_mw"])
        self.assertEqual(empty["coverage_status"], "unknown")
        self.assertIsNone(empty["overpass_count"])
        self.assertTrue(all(not row["request_contains_complete_solar_day"] for row in rows if row["solar_date"] in ("2020-07-31", "2020-08-15")))

    def test_pinned_reference_and_bounding_box(self):
        polygon, references = load_reference(REFERENCE)
        self.assertTrue(polygon.is_valid)
        self.assertEqual(len(references["modis"]["records"]), 6779)
        self.assertEqual(len(references["viirs"]["records"]), 26464)
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "manifest.json").write_text("{}")
            with self.assertRaises(NormalizationError):
                load_reference(root)

    def test_empty_responses_publish_audit_without_observed_zeros(self):
        calls = []
        def downloader(**kwargs):
            calls.append(kwargs)
            output = kwargs["output"]
            output.mkdir(parents=True)
            payload = b"latitude,longitude,acq_date,acq_time,satellite,confidence,frp\n"
            (output / "detections.csv").write_bytes(payload)
            metadata = {"sha256": hashlib.sha256(payload).hexdigest(), "source": kwargs["source"],
                        "processing_level": "SP", "bytes": len(payload), "row_count": 0}
            (output / "provenance.json").write_text(json.dumps(metadata))
            return metadata
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "pilot"
            result = run_pilot(output=output, reference=REFERENCE, map_key="test-secret", downloader=downloader)
            self.assertEqual(len(calls), 6)
            self.assertEqual(result["sources"]["modis"]["reference_only_occurrences"], 6779)
            self.assertTrue(all(row["raw_frp_sum_mw"] is None for row in json.loads((output / "daily-audit.json").read_text())))
            self.assertNotIn("test-secret", (output / "audit.json").read_text())
            self.assertFalse((output / "normalized").exists())
            with self.assertRaises(NormalizationError):
                run_pilot(output=output, reference=REFERENCE, map_key="test-secret", downloader=downloader)

    def test_provider_failure_is_atomic(self):
        def failure(**kwargs):
            raise DownloadError("Provider unavailable")
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            with self.assertRaises(DownloadError):
                run_pilot(output=root / "pilot", reference=REFERENCE, map_key="test-secret", downloader=failure)
            self.assertEqual(list(root.iterdir()), [])
