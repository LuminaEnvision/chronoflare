import copy
import csv
import json
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from indicator_quality import CRITICAL, audit_csv, classify_quality
from normalize_detections import NormalizationError


def modis(**changes):
    return {"latitude": "-18.5", "longitude": "-56.5", "acq_date": "2020-08-10", "acq_time": "0345",
            "satellite": "T", "instrument": "MODIS", "daynight": "N", "frp": "11.7", "confidence": "30", "type": "0", **changes}


def viirs(**changes):
    return modis(**{"satellite": "N", "instrument": "SNPP", "confidence": "n", **changes})


class IndicatorQualityTests(unittest.TestCase):
    def test_modis_confidence_boundaries(self):
        for value, category, passed in [(0, "low", False), (29, "low", False), (30, "nominal", True), (79, "nominal", True), (80, "high", True), (100, "high", True)]:
            with self.subTest(confidence=value):
                result = classify_quality(modis(confidence=str(value)), "MODIS_SP")
                self.assertEqual(result["confidence_class"], category)
                self.assertEqual(result["quality_pass"], passed)
        self.assertTrue(classify_quality(modis(confidence="30.0"), "MODIS_SP")["quality_pass"])
        for value in ("-1", "101", "30.5", "unexpected", "NaN"):
            self.assertFalse(classify_quality(modis(confidence=value), "MODIS_SP")["quality_pass"])

    def test_viirs_classes_and_instrument_alias(self):
        for value, passed in [("l", False), ("LOW", False), ("n", True), ("Nominal", True), ("h", True), ("HIGH", True), ("90", False)]:
            result = classify_quality(viirs(confidence=value), "VIIRS_SNPP_SP")
            self.assertEqual(result["quality_pass"], passed)
        self.assertTrue(classify_quality(viirs(instrument="VIIRS"), "VIIRS_SNPP_SP")["quality_pass"])
        self.assertFalse(classify_quality(viirs(instrument="MODIS"), "VIIRS_SNPP_SP")["quality_pass"])
        self.assertFalse(classify_quality(viirs(), "VIIRS_NOAA20_SP")["quality_pass"])

    def test_missing_every_critical_field_fails_without_mutating_input(self):
        for field in CRITICAL:
            with self.subTest(field=field):
                raw = modis(); raw.pop(field)
                before = copy.deepcopy(raw)
                result = classify_quality(raw, "MODIS_SP")
                self.assertFalse(result["quality_pass"])
                self.assertIn("missing_critical_field", result["quality_reasons"])
                self.assertEqual(raw, before)

    def test_non_positive_and_non_finite_frp_are_not_imputed(self):
        for value in ("0", "-2", "NaN", "Infinity", "", None):
            result = classify_quality(modis(frp=value), "MODIS_SP")
            self.assertFalse(result["quality_pass"])
            self.assertIn("non_positive_frp", result["quality_reasons"])

    def test_invalid_coordinates_dates_and_turns(self):
        for change in ({"latitude": "91"}, {"longitude": "-181"}, {"latitude": "NaN"}, {"acq_date": "2020-02-30"}, {"acq_time": "2460"}, {"daynight": "unknown"}, {"instrument": "VIIRS"}):
            self.assertFalse(classify_quality(modis(**change), "MODIS_SP")["quality_pass"])
        self.assertTrue(classify_quality(modis(acq_time="0"), "MODIS_SP")["quality_pass"])

    def test_sp_type_is_required_and_not_truncated(self):
        for value in (None, "", "1", "2", "3", "0.9", "-1", "unknown"):
            self.assertFalse(classify_quality(modis(type=value), "MODIS_SP")["quality_pass"])
        self.assertTrue(classify_quality(modis(type="0.0"), "MODIS_SP")["quality_pass"])

    def test_auxiliary_fields_do_not_change_validity(self):
        self.assertTrue(classify_quality(modis(scan="", track=None, brightness="NaN"), "MODIS_SP")["quality_pass"])

    def test_nrt_is_blocked_without_a_registered_mask(self):
        result = classify_quality(modis(), "MODIS_SP", processing_level="NRT")
        self.assertFalse(result["quality_pass"])
        self.assertIn("nrt_static_mask_not_registered", result["quality_reasons"])
        self.assertFalse(classify_quality(modis(version="6.1NRT"), "MODIS_SP")["quality_pass"])
        self.assertFalse(classify_quality(modis(processing_level="NRT"), "MODIS_SP")["quality_pass"])
        with self.assertRaises(ValueError):
            classify_quality(modis(), "unknown")

    def test_audit_retains_rejected_and_missing_field_rows_with_lineage(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            path = root / "source.csv"
            valid = modis(); invalid = modis(frp="-1"); missing = modis(instrument="")
            with path.open("w", newline="") as stream:
                writer = csv.DictWriter(stream, fieldnames=list(valid))
                writer.writeheader(); writer.writerows([valid, invalid, missing])
            report = audit_csv(input_path=path, source="MODIS_SP", output=root / "audit")
            self.assertEqual(report["quality_pass_count"], 1)
            self.assertEqual(report["quality_fail_count"], 2)
            self.assertFalse(report["harmonization_approved"])
            rows = [json.loads(line) for line in (root / "audit/quality-audit.jsonl").read_text().splitlines()]
            self.assertEqual(len(rows), 3)
            self.assertEqual(rows[1]["raw_record"]["frp"], "-1")
            self.assertEqual(rows[2]["raw_record"]["instrument"], "")
            self.assertEqual(rows[0]["source_record"], 1)
            self.assertEqual(rows[2]["source_file_sha256"], report["source_file_sha256"])
            with self.assertRaises(NormalizationError):
                audit_csv(input_path=path, source="MODIS_SP", output=root / "audit")

    def test_malformed_csv_does_not_publish_partial_output(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); path = root / "bad.csv"
            path.write_text("latitude,longitude\n-18,-56,unexpected\n")
            with self.assertRaises(NormalizationError):
                audit_csv(input_path=path, source="MODIS_SP", output=root / "audit")
            self.assertFalse((root / "audit").exists())
