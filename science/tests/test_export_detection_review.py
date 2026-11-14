import csv
import json
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from export_detection_review import export_review
from normalize_detections import NormalizationError, file_hash


class ExportReviewTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        for key, satellite, confidence, instrument in [
            ("modis", "Terra", 10, "MODIS"),
            ("viirs", "SNPP", "l", "SNPP"),
        ]:
            path = self.root / f"{key}.csv"
            with path.open("w", newline="") as stream:
                writer = csv.writer(stream)
                writer.writerow(
                    [
                        "latitude",
                        "longitude",
                        "acq_date",
                        "acq_time",
                        "satellite",
                        "confidence",
                        "frp",
                        "instrument",
                    ]
                )
                for latitude, longitude in [(1, 1), (0, 2), (9, 9), (1, 1)]:
                    writer.writerow(
                        [
                            latitude,
                            longitude,
                            "2020-08-01",
                            "0430",
                            satellite,
                            confidence,
                            0,
                            instrument,
                        ]
                    )
        self.args = dict(
            modis=self.root / "modis.csv",
            viirs=self.root / "viirs.csv",
            start="2020-08-01",
            end="2020-08-02",
            modis_request="123",
            viirs_request="124",
            output=self.root / "review",
        )

    def test_retains_all_original_records_without_clipping_quality_filters_or_deduplication(
        self,
    ):
        original = {key: self.args[key].read_bytes() for key in ("modis", "viirs")}
        result = export_review(**self.args)
        self.assertEqual(result["status"], "raw_unreviewed")
        self.assertEqual(result["aoi_status"], "not_applied")
        self.assertEqual(result["scope"], "brazil_download")
        self.assertNotIn("aoi", result)
        self.assertFalse((self.args["output"] / "aoi.json").exists())
        self.assertEqual(result["sources"]["viirs"]["record_count"], 4)
        path = self.args["output"] / "viirs/2020-08-01.json"
        rows = json.loads(path.read_text())["points"]
        self.assertEqual([row[0] for row in rows], [1, 2, 3, 4])
        self.assertTrue(all(len(row) == 8 for row in rows))
        self.assertEqual(rows[0][6], "l")
        self.assertEqual(
            result["sources"]["viirs"]["days"][0]["sha256"], file_hash(path)
        )
        self.assertEqual(
            json.loads((self.args["output"] / "viirs/2020-08-02.json").read_text())[
                "points"
            ],
            [],
        )
        for key, value in original.items():
            self.assertEqual(self.args[key].read_bytes(), value)
        self.assertFalse(any(self.args["output"].rglob("*.jsonl")))

    def test_deterministic_output_and_no_overwrite(self):
        export_review(**self.args)
        before = {
            str(p.relative_to(self.args["output"])): p.read_bytes()
            for p in self.args["output"].rglob("*")
            if p.is_file()
        }
        with self.assertRaises(NormalizationError):
            export_review(**self.args)
        other = self.root / "other"
        export_review(**{**self.args, "output": other})
        self.assertEqual(
            before,
            {
                str(p.relative_to(other)): p.read_bytes()
                for p in other.rglob("*")
                if p.is_file()
            },
        )

    def test_invalid_later_source_rolls_back_entire_export(self):
        self.args["viirs"].write_text("invalid\n")
        with self.assertRaises(NormalizationError):
            export_review(**self.args)
        self.assertFalse(self.args["output"].exists())
        self.assertEqual(list(self.root.glob(".review-*")), [])

    def test_out_of_window_records_are_not_silently_dropped(self):
        with self.assertRaises(NormalizationError):
            export_review(**{**self.args, "start": "2020-08-02"})
        self.assertFalse(self.args["output"].exists())

    def test_calendar_asset_path_blocked(self):
        project = Path(__file__).resolve().parents[2]
        for path in [
            project / "app/public/data/v1/review-rejected",
            project / "dist/review-rejected",
        ]:
            with self.subTest(path=path), self.assertRaises(NormalizationError):
                export_review(**{**self.args, "output": path})
