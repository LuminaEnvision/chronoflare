import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
from shapely.geometry import Polygon

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from export_detection_review import write_json, SCHEMA
from normalize_detections import NormalizationError
from prepare_pantanal_review import partition, prepare_region, official_boundary


class PantanalReviewTests(unittest.TestCase):
    def test_partition_handles_holes_boundary_and_coincident_records(self):
        polygon = Polygon(
            [(0, 0), (4, 0), (4, 4), (0, 4)], holes=[[(1, 1), (2, 1), (2, 2), (1, 2)]]
        )
        points = [
            [i, x, y, "04:30:00Z", "S-NPP", 0, "l", "0"]
            for i, (x, y) in enumerate([(3, 3), (0, 2), (1.5, 1.5), (9, 9), (3, 3)], 1)
        ]
        selected, boundary = partition(points, polygon)
        self.assertEqual([row[0] for row in selected], [1, 2, 5])
        self.assertEqual(boundary, 1)
        self.assertEqual(selected[0], points[0])
        self.assertEqual(partition([], polygon), ([], 0))

    def test_unverified_archive_is_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "archive.zip"
            path.write_bytes(b"unverified")
            with self.assertRaisesRegex(NormalizationError, "pinned"):
                official_boundary(path)

    def make_package(self, root):
        sources = {}
        for key, platform in [("modis", "Terra"), ("viirs", "S-NPP")]:
            item = write_json(
                root / key / "2020-08-01.json",
                {
                    "schema_version": SCHEMA,
                    "date": "2020-08-01",
                    "source": key,
                    "points": [
                        [
                            1,
                            1,
                            1,
                            "04:30:00Z",
                            platform,
                            0,
                            "l" if key == "viirs" else "10",
                            "0",
                        ],
                        [
                            2,
                            9,
                            9,
                            "04:30:00Z",
                            platform,
                            1,
                            "n" if key == "viirs" else "50",
                            "0",
                        ],
                    ],
                },
            )
            item.update(path=f"{key}/2020-08-01.json", date="2020-08-01", count=2)
            sources[key] = {"record_count": 2, "days": [item]}
        write_json(
            root / "manifest.json",
            {
                "schema_version": SCHEMA,
                "scope": "brazil_download",
                "status": "raw_unreviewed",
                "sources": sources,
                "notice": "Synthetic test package.",
            },
        )

    def test_preserves_national_bytes_and_rolls_back_corrupt_later_asset(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            national = root / "national"
            self.make_package(national)
            before = {
                p.relative_to(national): p.read_bytes()
                for p in national.rglob("*")
                if p.is_file()
            }
            polygon = Polygon([(0, 0), (4, 0), (4, 4), (0, 4)])
            with patch(
                "prepare_pantanal_review.official_boundary",
                return_value=(polygon, {"test_only": True}),
            ):
                result = prepare_region(
                    national=national, archive=root / "unused", output=root / "subset"
                )
                self.assertEqual(
                    result["pantanal"]["sources"]["viirs"]["record_count"], 1
                )
                for name, content in before.items():
                    self.assertEqual((national / name).read_bytes(), content)
                    if str(name) != "manifest.json":
                        self.assertEqual((root / "subset" / name).read_bytes(), content)
                with self.assertRaises(NormalizationError):
                    prepare_region(
                        national=national,
                        archive=root / "unused",
                        output=root / "subset",
                    )
                (national / "viirs/2020-08-01.json").write_text("{}")
                with self.assertRaises(NormalizationError):
                    prepare_region(
                        national=national,
                        archive=root / "unused",
                        output=root / "failed",
                    )
                self.assertFalse((root / "failed").exists())
                self.assertEqual(list(root.glob(".pantanal-*")), [])

    def test_frontend_output_is_blocked_before_processing(self):
        project = Path(__file__).resolve().parents[2]
        with self.assertRaises(NormalizationError):
            prepare_region(
                national=project / "app/public/data/detection-review/v1",
                archive=Path("/not/read"),
                output=project / "app/public/data/v1/blocked",
            )
