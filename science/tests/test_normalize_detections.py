import csv
import hashlib
import io
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from firms_download import download_area
from normalize_detections import NormalizationError, normalize_csv

HEADERS = ["latitude", "longitude", "acq_date", "acq_time", "satellite", "instrument", "confidence", "frp", "version", "daynight", "scan", "track", "type"]
MODIS = ["-18.500", "-56.50", "2024-02-29", "430", "T", "MODIS", " 15 ", "12.5", "6.1", "N", "1.1", "1.2", "2"]
VIIRS = ["-18.5", "-56.5", "2024-02-29", "0430", "N", "VIIRS", "l", "0", "2.0", "D", "0.375", "0.375", "0"]


class Response(io.BytesIO):
    status = 200


class NormalizeDetectionsTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.input = self.root / "input.csv"
        self.output = self.root / "normalized"

    def write_csv(self, rows=None, headers=HEADERS, bom=False):
        with self.input.open("w", encoding="utf-8-sig" if bom else "utf-8", newline="") as target:
            writer = csv.writer(target)
            writer.writerow(headers)
            writer.writerows([MODIS] if rows is None else rows)

    def run_normalization(self, source="MODIS_SP", **overrides):
        args = dict(input_path=self.input, source=source, output=self.output)
        args.update(overrides)
        report = normalize_csv(**args)
        rows = [json.loads(line) for line in (args["output"] / "detections.jsonl").read_text().splitlines()]
        return report, rows

    def test_modis_preserves_originals_without_quality_filters(self):
        self.write_csv()
        original = self.input.read_bytes()
        report, rows = self.run_normalization()
        row = rows[0]
        self.assertEqual(row["satellite"], "Terra")
        self.assertEqual(row["acquired_at_utc"], "2024-02-29T04:30:00Z")
        self.assertEqual(row["frp_mw"], 12.5)
        self.assertEqual(row["confidence_raw"], " 15 ")
        self.assertEqual(row["raw_record"], dict(zip(HEADERS, MODIS)))
        self.assertEqual(row["source_type"], "2")
        self.assertEqual(row["collection"], "6.1")
        for field in ("confidence_class", "quality_pass", "quality_rule_version", "local_solar_date", "region_id", "cell_id"):
            self.assertIsNone(row[field])
        self.assertEqual(report["scientific_status"], "unreviewed")
        self.assertEqual(report["coverage_status"], "unknown")
        self.assertFalse(report["input_provenance_verified"])
        self.assertEqual(self.input.read_bytes(), original)
        self.assertEqual(row["source_file_sha256"], hashlib.sha256(original).hexdigest())

    def test_viirs_class_mapping_retains_low_confidence_and_zero_frp(self):
        self.write_csv([VIIRS])
        report, rows = self.run_normalization("VIIRS_SNPP_SP")
        self.assertEqual(report["record_count"], 1)
        self.assertEqual(rows[0]["satellite"], "S-NPP")
        self.assertEqual(rows[0]["confidence_class"], "low")
        self.assertEqual(rows[0]["confidence_raw"], "l")
        self.assertEqual(rows[0]["frp_mw"], 0)
        self.assertIsNone(rows[0]["quality_pass"])

    def test_snpp_archive_instrument_alias_preserves_raw_fields(self):
        row = list(VIIRS)
        row[4], row[5], row[8] = "SNPP", "SNPP", "2"
        self.write_csv([row])
        report, rows = self.run_normalization("VIIRS_SNPP_SP")
        self.assertEqual(rows[0]["sensor"], "VIIRS")
        self.assertEqual(rows[0]["satellite"], "S-NPP")
        self.assertEqual(rows[0]["raw_record"]["instrument"], "SNPP")
        self.assertEqual(report["collections"], ["2"])

    def test_snpp_instrument_alias_is_not_accepted_for_other_sources(self):
        for source, platform in [("MODIS_SP", "Terra"), ("VIIRS_NOAA20_SP", "N20"), ("VIIRS_NOAA21_SP", "N21")]:
            with self.subTest(source=source):
                row = list(MODIS if source == "MODIS_SP" else VIIRS)
                row[4], row[5] = platform, "SNPP"
                self.write_csv([row])
                with self.assertRaisesRegex(NormalizationError, "Instrument"):
                    self.run_normalization(source)
                self.assertFalse(self.output.exists())

    def test_other_platform_aliases(self):
        for satellite, source, expected in [("Aqua", "MODIS_SP", "Aqua"), ("N20", "VIIRS_NOAA20_SP", "NOAA-20"), ("NOAA-21", "VIIRS_NOAA21_SP", "NOAA-21")]:
            with self.subTest(source=source):
                row = list(MODIS if source == "MODIS_SP" else VIIRS)
                row[4] = satellite
                self.write_csv([row])
                _, rows = self.run_normalization(source, output=self.root / expected)
                self.assertEqual(rows[0]["satellite"], expected)

    def test_equivalent_coordinates_and_times_have_stable_identity(self):
        second = list(MODIS)
        second[0:2] = ["-18.5", "-56.5000"]
        second[3:5] = ["0430", "Terra"]
        self.write_csv([MODIS, second])
        report, rows = self.run_normalization()
        self.assertEqual(report["record_count"], 2)
        self.assertEqual(report["duplicate_identity_count"], 1)
        self.assertEqual(rows[0]["detection_id"], rows[1]["detection_id"])
        self.assertEqual([r["source_record"] for r in rows], [1, 2])

    def test_repeated_identity_with_different_frp_is_not_silently_dropped(self):
        second = list(MODIS)
        second[7] = "99"
        self.write_csv([MODIS, second])
        report, rows = self.run_normalization()
        self.assertEqual(report["duplicate_identity_count"], 1)
        self.assertEqual([r["frp_mw"] for r in rows], [12.5, 99])

    def test_reruns_create_identical_jsonl_without_overwriting(self):
        self.write_csv()
        first, _ = self.run_normalization()
        second, _ = self.run_normalization(output=self.root / "second")
        self.assertEqual(first["output_sha256"], second["output_sha256"])
        with self.assertRaisesRegex(NormalizationError, "already exists"):
            self.run_normalization()

    def test_header_only_has_unknown_coverage_and_no_observation_range(self):
        self.write_csv([])
        report, rows = self.run_normalization()
        self.assertEqual(rows, [])
        self.assertEqual(report["record_count"], 0)
        self.assertIsNone(report["actual_acquisition_range_utc"])
        self.assertEqual(report["coverage_status"], "unknown")

    def test_bom_case_insensitive_headers_and_unknown_columns_are_preserved(self):
        self.write_csv([MODIS + ["unmodified"]], [name.title() for name in HEADERS] + ["Extra field"], bom=True)
        _, rows = self.run_normalization()
        self.assertEqual(rows[0]["raw_record"]["Extra field"], "unmodified")
        self.assertIn("Latitude", rows[0]["raw_record"])

    def test_missing_optional_fields_remain_unknown(self):
        required = HEADERS[:5] + ["confidence", "frp"]
        values = MODIS[:5] + [MODIS[6], MODIS[7]]
        self.write_csv([values], required)
        report, rows = self.run_normalization()
        for field in ("collection", "day_night", "source_type", "scan", "track"):
            self.assertIsNone(rows[0][field])
        self.assertEqual(report["missing_collection_count"], 1)
        self.assertEqual(report["missing_source_type_count"], 1)
        self.assertEqual(report["missing_day_night_count"], 1)

    def test_rt_urt_nrt_are_never_misclassified_as_sp(self):
        for suffix in ("NRT", "RT", "URT"):
            row = list(MODIS)
            row[8] = "6.1" + suffix
            self.write_csv([row])
            with self.subTest(suffix=suffix), self.assertRaisesRegex(NormalizationError, "Non-SP"):
                self.run_normalization()
            self.assertFalse(self.output.exists())

    def test_invalid_rows_abort_without_partial_output(self):
        for index, value in [(0, "NaN"), (0, "91"), (1, "-181"), (2, "2023-02-29"), (3, "2460"), (3, "4.0"), (4, "N20"), (5, "VIIRS"), (6, "101"), (7, "-1"), (7, "Infinity"), (8, "unknown"), (9, "X"), (10, "0"), (12, "9")]:
            with self.subTest(index=index, value=value):
                row = list(MODIS)
                row[index] = value
                self.write_csv([MODIS, row])
                with self.assertRaises(NormalizationError):
                    self.run_normalization()
                self.assertFalse(self.output.exists())
                self.assertEqual(list(self.root.glob(".normalize-*")), [])

    def test_invalid_headers_and_column_counts(self):
        for headers, rows in [(HEADERS + ["Latitude"], [MODIS + ["0"]]), (HEADERS + [""], [MODIS + ["0"]]), (["wrong"], [["header"]]), (HEADERS, [MODIS[:-1]]), (HEADERS, [MODIS + ["extra"]])]:
            with self.subTest(headers=headers):
                self.write_csv(rows, headers)
                with self.assertRaises(NormalizationError):
                    self.run_normalization()
                self.assertFalse(self.output.exists())

    def test_downloader_provenance_integrates_without_network_or_credentials(self):
        self.write_csv()
        raw_dir = self.root / "download"
        download_area(source="MODIS_SP", bbox="-58,-20,-54,-16", start="2024-02-29", days=1, output=raw_dir, map_key="test-only-key", opener=lambda request, timeout: Response(self.input.read_bytes()))
        report, rows = self.run_normalization(input_path=raw_dir / "detections.csv", provenance=raw_dir / "provenance.json")
        self.assertTrue(report["input_provenance_verified"])
        self.assertEqual(report["record_count"], 1)
        self.assertIsNotNone(report["retrieved_at_utc"])
        self.assertNotIn("test-only-key", json.dumps(report))

    def test_modified_input_and_mismatched_provenance_are_rejected(self):
        self.write_csv()
        provenance = self.root / "provenance.json"
        base = {"sha256": hashlib.sha256(self.input.read_bytes()).hexdigest(), "source": "MODIS_SP", "processing_level": "SP"}
        for patch in [{"sha256": "0" * 64}, {"source": "VIIRS_SNPP_SP"}, {"processing_level": "NRT"}, {"row_count": 2}, {"bytes": 0}, {"retrieved_at_utc": "2024-01-01"}]:
            provenance.write_text(json.dumps({**base, **patch}))
            with self.subTest(patch=patch), self.assertRaises(NormalizationError):
                self.run_normalization(provenance=provenance)
            self.assertFalse(self.output.exists())

    def test_frontend_output_directories_are_blocked(self):
        self.write_csv()
        project = Path(__file__).resolve().parents[2]
        for output in (project / "app" / "public" / "unsafe-normalization", project / "dist" / "unsafe-normalization"):
            with self.assertRaisesRegex(NormalizationError, "cannot be written"):
                self.run_normalization(output=output)

    def test_cli_reports_an_english_error_without_a_traceback(self):
        self.write_csv([MODIS[:-1]])
        command = [sys.executable, str(Path(__file__).resolve().parents[1] / "scripts" / "normalize_detections.py"), "--input", str(self.input), "--source", "MODIS_SP", "--output", str(self.output)]
        result = subprocess.run(command, capture_output=True, text=True)
        self.assertEqual(result.returncode, 1)
        self.assertIn("column count", result.stderr)
        self.assertNotIn("Traceback", result.stderr)
        self.assertFalse(self.output.exists())


if __name__ == "__main__":
    unittest.main()
