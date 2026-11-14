import csv
import json
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from diagnose_detections import diagnose, load_polygon
from normalize_detections import NormalizationError, file_hash

SQUARE = [[0, 0], [4, 0], [4, 4], [0, 4], [0, 0]]
HOLE = [[1, 1], [2, 1], [2, 2], [1, 2], [1, 1]]


class DiagnosticTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.aoi = self.root / "aoi.geojson"
        self.aoi.write_text(json.dumps({"type": "Polygon", "coordinates": [SQUARE, HOLE]}))
        self.csv = self.root / "raw.csv"
        with self.csv.open("w", newline="") as stream:
            writer = csv.writer(stream)
            writer.writerow(["latitude", "longitude", "acq_date", "acq_time", "satellite", "confidence", "frp"])
            for lat, lon, platform, frp in [(3,3,"T",0), (0,2,"A",5), (1.5,1.5,"T",7), (8,8,"A",3), (3,3,"T",0)]:
                writer.writerow([lat,lon,"2020-08-01","0430",platform,10,frp])
        self.output = self.root / "diagnostic"

    def run_diagnostic(self):
        return diagnose(input_path=self.csv, source="MODIS_SP", aoi=self.aoi, aoi_reference="Unconfirmed test geometry", output=self.output)

    def test_partitions_holes_edges_and_duplicates_without_changing_records(self):
        before = self.csv.read_bytes()
        report = self.run_diagnostic()
        self.assertEqual({k:v["record_count"] for k,v in report["groups"].items()}, {"all":5,"inside":2,"boundary":1,"outside":2})
        self.assertEqual(report["groups"]["inside"]["daily_by_platform_utc"][0]["raw_frp_sum_mw"],0)
        self.assertEqual(report["aoi_status"], "unconfirmed")
        self.assertEqual(report["coverage_status"], "unknown")
        self.assertEqual(before,self.csv.read_bytes())
        self.assertEqual(self.aoi.read_bytes(),(self.output / "aoi.geojson").read_bytes())
        records=[]
        for category in ("inside","boundary","outside"):
            path=self.output / f"{category}.jsonl"
            self.assertEqual(file_hash(path),report["partition_sha256"][category])
            records.extend(json.loads(line) for line in path.read_text().splitlines())
        original=[json.loads(line) for line in (self.output / "normalized/detections.jsonl").read_text().splitlines()]
        self.assertEqual(sorted(records,key=lambda r:r["source_record"]),original)
        self.assertTrue(all(r["region_id"] is None for r in records))

    def test_multipolygon_and_feature_collection(self):
        self.aoi.write_text(json.dumps({"type":"FeatureCollection","features":[{"type":"Feature","geometry":{"type":"MultiPolygon","coordinates":[[SQUARE]]},"properties":{}}]}))
        self.assertTrue(load_polygon(self.aoi).is_valid)

    def test_invalid_unsupported_or_projected_geometry_rejected(self):
        for value in [
            {"type":"Polygon","coordinates":[[[0,0],[4,4],[0,4],[4,0],[0,0]]]},
            {"type":"FeatureCollection","features":[]},
            {"type":"Point","coordinates":[0,0]},
            {"type":"Polygon","coordinates":[SQUARE[:-1]]},
            {"type":"Polygon","coordinates":[SQUARE],"crs":{"type":"name","properties":{"name":"EPSG:3857"}}},
            {"type":"Polygon","coordinates":[[[0,0,1],[1,0,1],[0,1,1],[0,0,1]]]},
            {"type":"Polygon","coordinates":[[[179,0],[-179,0],[-179,1],[179,0]]]},
        ]:
            with self.subTest(value=value):
                self.aoi.write_text(json.dumps(value))
                with self.assertRaises(NormalizationError):self.run_diagnostic()
                self.assertFalse(self.output.exists())

    def test_invalid_csv_cleans_staging(self):
        self.csv.write_text("invalid\n")
        with self.assertRaises(NormalizationError):self.run_diagnostic()
        self.assertFalse(self.output.exists())
        self.assertEqual(list(self.root.glob('.diagnose-*')),[])

    def test_existing_output_preserved(self):
        self.output.mkdir()
        (self.output / 'keep').write_text('keep')
        with self.assertRaises(NormalizationError):self.run_diagnostic()
        self.assertEqual((self.output / 'keep').read_text(),'keep')

    def test_frontend_path_and_symlink_alias_rejected(self):
        project=Path(__file__).resolve().parents[2]
        alias=self.root / 'alias';alias.symlink_to(project / 'app',target_is_directory=True)
        for output in [project / 'app/diagnostic-rejected',project / 'dist/diagnostic-rejected',alias / 'diagnostic-rejected']:
            self.output=output
            with self.assertRaises(NormalizationError):self.run_diagnostic()

    def test_empty_csv_does_not_fill_zero_days(self):
        self.csv.write_text(self.csv.read_text().splitlines()[0]+'\n')
        report=self.run_diagnostic()
        self.assertEqual(report['groups']['all']['daily_by_platform_utc'],[])
        self.assertEqual(report['groups']['all']['raw_frp_range_mw'],{'min':None,'max':None})
