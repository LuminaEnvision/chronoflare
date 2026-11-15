import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from export_solar_records import FIELDS, export_records
from normalize_detections import NormalizationError, file_hash


class SolarRecordExportTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.preview = self.root / "preview.json"
        self.row = {key: None for key in FIELDS}
        self.row.update(source_file_sha256="a" * 64, source_record=1, local_solar_date="2020-08-15", satellite="Terra", candidate_quality_pass=True)
        self.snapshot = {"quality_rule": {"status": "proposed_unapproved"}, "records": [{
            "platform": "Terra", "solar_date": "2020-08-15", "period_start_utc": "2020-08-15T03:46:36Z",
            "period_end_utc_exclusive": "2020-08-16T03:46:36Z", "all_detections": {"detection_count": 1},
            "proposed_filter": {"detection_count": 1}}]}
        self.preview.write_text(json.dumps(self.snapshot))
        self.output = self.root / "records"

    def reproduce(self, **kwargs):
        kwargs["output"].mkdir()
        (kwargs["output"] / "regional-detections.jsonl").write_text(json.dumps(self.row) + "\n")
        return self.snapshot

    def test_export_projects_only_supported_fields_and_preserves_hashes(self):
        with patch("export_solar_records.prepare_preview", self.reproduce):
            result = export_records(evidence=self.root / "evidence", preview=self.preview, output=self.output)
        entry = result["entries"][0]
        self.assertEqual(result["preview_sha256"], file_hash(self.preview))
        self.assertEqual(entry["sha256"], file_hash(self.output / entry["path"]))
        self.assertEqual(entry["record_count"], 1)
        record = json.loads((self.output / entry["path"]).read_text())["records"][0]
        self.assertEqual(set(record), set(FIELDS))
        self.assertNotIn("raw_record", record)
        with self.assertRaises(NormalizationError):
            export_records(evidence=self.root / "evidence", preview=self.preview, output=self.output)

    def test_snapshot_difference_does_not_publish_assets(self):
        with patch("export_solar_records.prepare_preview", return_value={"different": True}):
            with self.assertRaises(NormalizationError):
                export_records(evidence=self.root, preview=self.preview, output=self.output)
        self.assertFalse(self.output.exists())

    def test_count_mismatch_does_not_publish_assets(self):
        self.row["candidate_quality_pass"] = False
        with patch("export_solar_records.prepare_preview", self.reproduce):
            with self.assertRaises(NormalizationError):
                export_records(evidence=self.root, preview=self.preview, output=self.output)
        self.assertFalse(self.output.exists())

    def test_duplicate_source_row_is_not_silently_exported(self):
        self.snapshot["records"][0]["all_detections"]["detection_count"] = 2
        self.snapshot["records"][0]["proposed_filter"]["detection_count"] = 2
        self.preview.write_text(json.dumps(self.snapshot))
        def duplicate(**kwargs):
            self.reproduce(**kwargs)
            path = kwargs["output"] / "regional-detections.jsonl"
            path.write_text(path.read_text() * 2)
            return self.snapshot
        with patch("export_solar_records.prepare_preview", duplicate):
            with self.assertRaises(NormalizationError):
                export_records(evidence=self.root, preview=self.preview, output=self.output)
        self.assertFalse(self.output.exists())
