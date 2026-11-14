import hashlib
import json
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from firms_pilot import plan
from solar_preview import candidate_quality, prepare_preview, preview_rows, summarize


def detection(**changes):
    return {"source_type": "0", "sensor": "MODIS", "confidence_raw": "30", "confidence_class": None,
            "frp_mw": 11.7, "local_solar_date": "2020-08-15", "satellite": "Terra",
            "candidate_quality_pass": True, "candidate_quality_reasons": [], **changes}


class SolarPreviewTests(unittest.TestCase):
    def test_candidate_boundaries_and_missing_fields(self):
        self.assertEqual(candidate_quality(detection()), (True, []))
        self.assertFalse(candidate_quality(detection(confidence_raw="29"))[0])
        self.assertFalse(candidate_quality(detection(source_type=None))[0])
        self.assertFalse(candidate_quality(detection(source_type="2"))[0])
        self.assertTrue(candidate_quality(detection(sensor="VIIRS", confidence_class="nominal"))[0])
        self.assertTrue(candidate_quality(detection(sensor="VIIRS", confidence_class="high"))[0])
        self.assertFalse(candidate_quality(detection(sensor="VIIRS", confidence_class="low"))[0])

    def test_no_empty_or_zero_frp_is_promoted_to_observed_zero(self):
        self.assertEqual(summarize([]), {"detection_count": None, "raw_frp_sum_mw": None})
        self.assertEqual(summarize([detection(frp_mw=0)]), {"detection_count": 1, "raw_frp_sum_mw": None})

    def test_complete_grid_keeps_platforms_separate(self):
        rows = preview_rows([detection(), detection(candidate_quality_pass=False, candidate_quality_reasons=["low_confidence"])])
        self.assertEqual(len(rows), 45)
        terra = next(row for row in rows if row["platform"] == "Terra" and row["solar_date"] == "2020-08-15")
        self.assertEqual(terra["all_detections"]["detection_count"], 2)
        self.assertEqual(terra["proposed_filter"]["detection_count"], 1)
        self.assertEqual(terra["rejection_reason_counts"], {"low_confidence": 1})
        self.assertTrue(all(row["coverage_status"] == "unknown" and row["coverage_fraction"] is None and row["overpass_count"] is None for row in rows))
        self.assertTrue(all(row["all_detections"]["detection_count"] is None for row in rows if row["platform"] != "Terra"))

    def test_two_padding_calls_reuse_verified_base_and_preserve_lineage(self):
        payload = b"latitude,longitude,acq_date,acq_time,satellite,confidence,frp\n"
        def store(source, start, days, output, **kwargs):
            from datetime import date, timedelta
            output.mkdir(parents=True)
            (output / "detections.csv").write_bytes(payload)
            metadata = {"source": source, "sha256": hashlib.sha256(payload).hexdigest(),
                        "processing_level": "SP", "bbox": [-60., -23., -54., -15.],
                        "requested_start_utc": start,
                        "requested_end_utc_inclusive": (date.fromisoformat(start) + timedelta(days=days-1)).isoformat(),
                        "row_count": 0, "bytes": len(payload)}
            (output / "provenance.json").write_text(json.dumps(metadata))
            return metadata
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            evidence = root / "old"
            for request in plan():
                store(source=request["source"], start=request["start"], days=request["days"], output=evidence / "raw" / request["id"])
            calls = []
            def download(**kwargs):
                calls.append(kwargs)
                return store(**kwargs)
            output = root / "preview"
            preview = prepare_preview(evidence=evidence, output=output, map_key="test-secret", downloader=download)
            self.assertEqual(len(calls), 2)
            self.assertTrue(all(call["start"] == "2020-08-16" and call["days"] == 1 for call in calls))
            self.assertEqual(len(preview["provenance"]), 8)
            self.assertEqual(len(preview["records"]), 45)
            self.assertTrue(all(row["all_detections"]["detection_count"] is None for row in preview["records"]))
            self.assertNotIn("test-secret", (output / "pantanal-solar.json").read_text())
            self.assertFalse(preview["scientific_approval"])
            self.assertFalse(preview["approved_metric"])
