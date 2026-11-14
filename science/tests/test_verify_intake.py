import json
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from intake_batch import intake_batch
from normalize_detections import NormalizationError, file_hash
from verify_intake import verify_intake


class VerifyIntakeTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / "raw.csv").write_text("latitude,longitude,acq_date,acq_time,satellite,confidence,frp\n-18,-56,2020-08-01,0430,T,10,0\n")
        manifest = self.root / "manifest.json"
        manifest.write_text(json.dumps({"schema_version": "raw-intake/1.0.0", "files": [{"id": "modis", "input": "raw.csv", "source": "MODIS_SP"}]}))
        self.package = self.root / "package"
        intake_batch(manifest, self.package)
        self.batch = self.package / "batch-report.json"
        self.report = self.package / "modis/report.json"
        self.rows = self.package / "modis/detections.jsonl"

    def change_batch(self, update):
        batch = json.loads(self.batch.read_text())
        update(batch)
        self.batch.write_text(json.dumps(batch))

    def update_report(self, update):
        report = json.loads(self.report.read_text())
        update(report)
        self.report.write_text(json.dumps(report))
        def sync(batch):
            entry = batch["files"][0]
            entry.update(report)
            entry["report_sha256"] = file_hash(self.report)
        self.change_batch(sync)

    def test_valid_package_is_read_only_and_can_check_trusted_hash(self):
        before = {str(path): path.read_bytes() for path in self.package.rglob("*") if path.is_file()}
        result = verify_intake(self.package, file_hash(self.batch))
        self.assertEqual(result["record_count"], 1)
        self.assertTrue(result["trusted_hash_checked"])
        self.assertEqual(before, {str(path): path.read_bytes() for path in self.package.rglob("*") if path.is_file()})
        self.assertFalse(verify_intake(self.package)["trusted_hash_checked"])

    def test_wrong_trusted_hash_rejects(self):
        with self.assertRaisesRegex(NormalizationError, "trusted"):
            verify_intake(self.package, "0" * 64)

    def test_altered_detections_rejects(self):
        self.rows.write_text(self.rows.read_text().replace('"frp_mw":0.0', '"frp_mw":99.0'))
        with self.assertRaisesRegex(NormalizationError, "detections hash"):
            verify_intake(self.package)

    def test_altered_individual_report_rejects(self):
        self.report.write_text('{}')
        with self.assertRaisesRegex(NormalizationError, "report hash"):
            verify_intake(self.package)

    def test_altered_embedded_report_rejects(self):
        self.change_batch(lambda batch: batch["files"][0].update(record_count=99))
        with self.assertRaisesRegex(NormalizationError, "embedded"):
            verify_intake(self.package)

    def test_missing_file_rejects(self):
        self.rows.unlink()
        with self.assertRaisesRegex(NormalizationError, "missing"):
            verify_intake(self.package)

    def test_path_escape_and_symlink_escape_reject(self):
        outside = self.root / "outside.json"
        outside.write_bytes(self.report.read_bytes())
        alias = self.package / "alias.json"
        alias.symlink_to(outside)
        for path in ("../outside.json", str(outside), "alias.json"):
            with self.subTest(path=path):
                self.change_batch(lambda batch: batch["files"][0].update(report_file=path))
                with self.assertRaises(NormalizationError):
                    verify_intake(self.package)

    def test_total_and_duplicate_groups_reject_inconsistency(self):
        self.change_batch(lambda batch: batch.update(record_count=2))
        with self.assertRaisesRegex(NormalizationError, "Batch record count"):
            verify_intake(self.package)
        self.change_batch(lambda batch: batch.update(record_count=1, repeated_input_groups=[["modis"]]))
        with self.assertRaisesRegex(NormalizationError, "Repeated"):
            verify_intake(self.package)

    def test_rehashed_rows_still_require_consistent_provenance(self):
        row = json.loads(self.rows.read_text())
        row["source_record"] = 2
        self.rows.write_text(json.dumps(row) + "\n")
        self.update_report(lambda report: report.update(output_sha256=file_hash(self.rows)))
        with self.assertRaisesRegex(NormalizationError, "sequence"):
            verify_intake(self.package)

    def test_empty_package_records_are_valid_without_claiming_coverage(self):
        self.rows.write_text("")
        self.update_report(lambda report: report.update(record_count=0, output_sha256=file_hash(self.rows), actual_acquisition_range_utc=None))
        self.change_batch(lambda batch: batch.update(record_count=0))
        self.assertEqual(verify_intake(self.package)["record_count"], 0)

    def test_invalid_json_reports_are_handled(self):
        self.batch.write_text("[]")
        with self.assertRaises(NormalizationError):
            verify_intake(self.package)
