import csv
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from intake_batch import intake_batch
from normalize_detections import NormalizationError, file_hash


class IntakeBatchTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.manifest = self.root / "manifest.json"
        self.output = self.root / "batch"
        self.csv = self.root / "modis.csv"
        with self.csv.open("w", newline="") as stream:
            writer = csv.writer(stream)
            writer.writerow(["latitude", "longitude", "acq_date", "acq_time", "satellite", "confidence", "frp"])
            writer.writerow([-18, -56, "2020-08-01", "0430", "T", 10, 0])
        self.entry = {"id": "modis-2020", "input": "modis.csv", "source": "MODIS_SP"}

    def write_manifest(self, files=None):
        self.manifest.write_text(json.dumps({"schema_version": "raw-intake/1.0.0", "files": files if files is not None else [self.entry]}))

    def test_relative_paths_traceability_and_unchanged_inputs(self):
        self.write_manifest()
        original = self.csv.read_bytes()
        report = intake_batch(self.manifest, self.output)
        self.assertEqual(report["record_count"], 1)
        self.assertEqual(report["coverage_status"], "unknown")
        self.assertEqual(report["scientific_status"], "unreviewed")
        item = report["files"][0]
        self.assertEqual(item["report_sha256"], file_hash(self.output / item["report_file"]))
        self.assertEqual(item["input_sha256"], file_hash(self.csv))
        self.assertFalse(item["input_provenance_verified"])
        self.assertEqual(self.csv.read_bytes(), original)
        self.assertEqual(json.loads((self.output / "batch-report.json").read_text()), report)

    def test_repeated_files_are_flagged_and_retained(self):
        self.write_manifest([self.entry, {**self.entry, "id": "copy"}])
        report = intake_batch(self.manifest, self.output)
        self.assertEqual(report["record_count"], 2)
        self.assertEqual(report["repeated_input_groups"], [["modis-2020", "copy"]])
        self.assertTrue((self.output / "copy/detections.jsonl").exists())

    def test_later_invalid_input_rolls_back_entire_package(self):
        self.write_manifest([self.entry, {**self.entry, "id": "invalid", "source": "VIIRS_SNPP_SP"}])
        with self.assertRaisesRegex(NormalizationError, "File invalid"):
            intake_batch(self.manifest, self.output)
        self.assertFalse(self.output.exists())
        self.assertEqual(list(self.root.glob(".intake-*")), [])

    def test_missing_file_rolls_back(self):
        self.write_manifest([self.entry, {**self.entry, "id": "missing", "input": "absent.csv"}])
        with self.assertRaises(OSError):
            intake_batch(self.manifest, self.output)
        self.assertFalse(self.output.exists())
        self.assertEqual(list(self.root.glob(".intake-*")), [])

    def test_rejects_invalid_manifest_entries(self):
        for files in ([], [self.entry, self.entry], [{**self.entry, "id": "../escape"}], [{**self.entry, "source": []}], [{**self.entry, "input": 7}], [{**self.entry, "extra": True}]):
            with self.subTest(files=files):
                self.write_manifest(files)
                with self.assertRaises(NormalizationError):
                    intake_batch(self.manifest, self.output)
                self.assertFalse(self.output.exists())

    def test_existing_destination_is_preserved(self):
        self.write_manifest()
        self.output.mkdir()
        (self.output / "keep").write_text("original")
        with self.assertRaises(NormalizationError):
            intake_batch(self.manifest, self.output)
        self.assertEqual((self.output / "keep").read_text(), "original")

    def test_frontend_output_and_symlink_alias_are_blocked(self):
        self.write_manifest()
        project = Path(__file__).resolve().parents[2]
        alias = self.root / "alias"
        alias.symlink_to(project / "app", target_is_directory=True)
        for output in (project / "app/batch-rejected", project / "dist/batch-rejected", alias / "batch-rejected"):
            with self.subTest(output=output), self.assertRaises(NormalizationError):
                intake_batch(self.manifest, output)

    def test_empty_detection_csv_does_not_imply_zero_activity(self):
        self.csv.write_text("latitude,longitude,acq_date,acq_time,satellite,confidence,frp\n")
        self.write_manifest()
        report = intake_batch(self.manifest, self.output)
        self.assertEqual(report["record_count"], 0)
        self.assertIsNone(report["files"][0]["actual_acquisition_range_utc"])
        self.assertEqual(report["coverage_status"], "unknown")

    def test_provenance_mismatch_aborts(self):
        (self.root / "provenance.json").write_text('{}')
        self.write_manifest([{**self.entry, "provenance": "provenance.json"}])
        with self.assertRaisesRegex(NormalizationError, "provenance"):
            intake_batch(self.manifest, self.output)
        self.assertFalse(self.output.exists())

    def test_cli_reports_invalid_json_without_traceback(self):
        self.manifest.write_text("not JSON")
        result = subprocess.run([sys.executable, str(Path(__file__).resolve().parents[1] / "scripts/intake_batch.py"), "--manifest", str(self.manifest), "--output", str(self.output)], capture_output=True, text=True)
        self.assertEqual(result.returncode, 1)
        self.assertIn("Error:", result.stderr)
        self.assertNotIn("Traceback", result.stderr)
