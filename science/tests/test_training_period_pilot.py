from collections import Counter
import csv
from datetime import date, timedelta
import hashlib
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from normalize_detections import NormalizationError
from training_period_pilot import audit_year, duplicate_diagnostics, request_plan, run_pilot, turn_inventory

PROJECT = Path(__file__).resolve().parents[2]
REFERENCE = PROJECT / "app/public/data/detection-review/v1"


def record(**changes):
    return {"sensor": "MODIS", "satellite": "Terra", "acquired_at_utc": "2019-08-01T12:00:00Z", "local_solar_date": "2019-08-01",
            "day_night": "D", "raw_record": {"latitude": "-18.5", "longitude": "-56.5"}, "quality_pass": True, "frp_mw": 10., **changes}


class TrainingPeriodPilotTests(unittest.TestCase):
    def test_bounded_plan_covers_sixteen_utc_days_once_per_source(self):
        for year in (2019, 2020):
            requests = request_plan(year)
            self.assertEqual(len(requests), 8)
            for source in ("MODIS_SP", "VIIRS_SNPP_SP"):
                dates = [date.fromisoformat(item["start"]) + timedelta(days=offset) for item in requests if item["source"] == source for offset in range(item["days"])]
                self.assertEqual(dates, [date(year, 8, day) for day in range(1, 17)])
                self.assertTrue(all(count == 1 for count in Counter(dates).values()))
        for value in (2018, 2021, 2019.0, True):
            with self.assertRaises(ValueError): request_plan(value)

    def test_duplicate_conflicts_are_diagnostic_and_platform_scoped(self):
        rows = [record(), record(frp_mw=20., quality_pass=False), record(satellite="Aqua")]
        result = duplicate_diagnostics(rows)
        self.assertFalse(result["deduplication_applied"])
        for scenario in result["rounding_scenarios"].values():
            self.assertEqual(scenario["collision_groups"], 1)
            self.assertEqual(scenario["involved_records"], 2)
            self.assertEqual(scenario["conflicting_frp_groups"], 1)
            self.assertEqual(scenario["conflicting_quality_groups"], 1)
        self.assertEqual(len(rows), 3)

    def test_rounding_sensitivity_does_not_pick_a_winner(self):
        rows = [record(raw_record={"latitude": "-18.000005", "longitude": "-56"}), record(raw_record={"latitude": "-18.000004", "longitude": "-56"})]
        result = duplicate_diagnostics(rows)
        self.assertEqual(result["rounding_scenarios"]["half_even"]["collision_groups"], 1)
        self.assertEqual(result["rounding_scenarios"]["half_up"]["collision_groups"], 0)
        self.assertFalse(result["deduplication_applied"])

    def test_turn_inventory_retains_missing_as_null_and_marks_unknown_coverage(self):
        cells = turn_inventory([record(), record(quality_pass=False)], 2019)
        self.assertEqual(len(cells), 90)
        positive = next(row for row in cells if row["solar_date"] == "2019-08-01" and row["platform"] == "Terra" and row["day_night"] == "D")
        self.assertEqual(positive["quality_pass_count_before_dedup"], 1)
        self.assertEqual(positive["frp_audit_sum_mw_before_dedup"], 10.)
        missing = next(row for row in cells if row["solar_date"] == "2019-08-01" and row["platform"] == "Terra" and row["day_night"] == "N")
        self.assertIsNone(missing["quality_pass_count_before_dedup"])
        self.assertIsNone(missing["frp_audit_sum_mw_before_dedup"])
        self.assertTrue(all(row["coverage_status"] == "unknown" and row["coverage_fraction"] is None and row["overpass_count"] is None for row in cells))
        self.assertEqual(cells[-1]["period_end_utc_exclusive"], "2019-08-16T03:46:36+00:00")

    def test_empty_responses_remain_audits_not_zero_indicators(self):
        def download(**kwargs):
            output = kwargs["output"]; output.mkdir(parents=True)
            payload = b"latitude,longitude,acq_date,acq_time,satellite,instrument,daynight,frp,confidence,type\n"
            (output / "detections.csv").write_bytes(payload)
            metadata = {"source": kwargs["source"], "sha256": hashlib.sha256(payload).hexdigest(), "row_count": 0,
                        "bytes": len(payload), "processing_level": "SP"}
            (output / "provenance.json").write_text(json.dumps(metadata))
            return metadata
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "2019"
            report = audit_year(year=2019, output=output, downloader=download, map_key="test-key", reference=REFERENCE)
            self.assertEqual(report["request_count"], 8)
            self.assertFalse(report["calibration_performed"])
            self.assertTrue(all(row["quality_pass_count_before_dedup"] is None for row in report["cells"]))
            self.assertNotIn("test-key", (output / "audit.json").read_text())

    def test_frozen_replay_is_checked_before_new_network_requests(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); download = Mock()
            with self.assertRaises(OSError):
                run_pilot(output=root / "pilot", reference_evidence=root / "missing", map_key="test-key", downloader=download)
            download.assert_not_called()
            self.assertFalse((root / "pilot").exists())

    def test_replay_hash_mismatch_stops_before_normalization(self):
        def download(**kwargs):
            return {"sha256": "a" * 64}
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaises(NormalizationError) as caught:
                audit_year(year=2020, output=Path(directory) / "2020", downloader=download, map_key="unused", reference=REFERENCE, expected_provenance=[])
            self.assertIn("Replay source hash", str(caught.exception))

    def test_existing_bundle_replays_both_years_without_key_or_network(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            evidence = root / "bundle"
            (evidence / "2019/raw").mkdir(parents=True)
            (evidence / "2020/raw").mkdir(parents=True)
            calls = []
            def audit(**kwargs):
                calls.append(kwargs)
                kwargs["output"].mkdir()
                return {"quality_rule_version": "same-rule", "boundary_sha256": "a" * 64}
            download = Mock()
            with patch("training_period_pilot.audit_year", audit):
                result = run_pilot(output=root / "replay", reference_evidence=evidence, map_key=None, downloader=download)
            self.assertEqual(result["new_nasa_requests"], 0)
            self.assertEqual(result["replayed_requests"], 16)
            self.assertEqual([call["year"] for call in calls], [2020, 2019])
            self.assertTrue(all(call["expected_provenance"] for call in calls))
            download.assert_not_called()

    def test_committed_live_reports_reconcile_sources_turns_and_frozen_2020(self):
        frozen = json.loads((PROJECT / "app/public/data/experimental/v1/pantanal-solar.json").read_text())
        for year in (2019, 2020):
            report = json.loads((PROJECT / f"docs/training-period-audit/{year}-august-summary.json").read_text())
            self.assertEqual(len(report["cells"]), 90)
            self.assertEqual(len(report["requests"]), 8)
            self.assertEqual({(row["source"], row["start"], row["days"]) for row in report["requests"]}, {(row["source"], row["start"], row["days"]) for row in request_plan(year)})
            for request in report["requests"]:
                self.assertEqual(request["download"]["sha256"], request["normalization"]["input_sha256"])
                self.assertEqual(request["download"]["row_count"], request["normalization"]["record_count"])
            for platform, population in report["platforms"].items():
                cells = [cell for cell in report["cells"] if cell["platform"] == platform]
                self.assertEqual(sum(cell["raw_record_count"] for cell in cells) + population["missing_turn_records"], population["raw_records"])
                self.assertEqual(sum(cell["quality_pass_count_before_dedup"] or 0 for cell in cells), population["quality_pass_before_dedup"])
                self.assertEqual(population["raw_records"], population["quality_pass_before_dedup"] + population["quality_fail"])
                if year == 2020:
                    old = [cell for cell in frozen["records"] if cell["platform"] == platform]
                    self.assertEqual(sum(cell["all_detections"]["detection_count"] or 0 for cell in old), population["raw_records"])
                    self.assertLessEqual(population["quality_pass_before_dedup"], sum(cell["proposed_filter"]["detection_count"] or 0 for cell in old))
            for cell in report["cells"]:
                self.assertEqual(cell["coverage_status"], "unknown")
                self.assertIsNone(cell["coverage_fraction"])
                self.assertIsNone(cell["overpass_count"])
                if cell["quality_pass_count_before_dedup"] is None:
                    self.assertIsNone(cell["frp_audit_sum_mw_before_dedup"])
                else:
                    self.assertGreater(cell["frp_audit_sum_mw_before_dedup"], 0)
            self.assertFalse(report["deduplication_applied"])
            self.assertFalse(report["calibration_performed"])
            self.assertFalse(report["validation_performed"])
            self.assertFalse(report["harmonization_approved"])

    def test_regional_lineage_and_utc_padding_keep_invalid_and_conflicting_rows(self):
        def download(**kwargs):
            output = kwargs["output"]; output.mkdir(parents=True)
            modis = kwargs["source"] == "MODIS_SP"
            with (output / "detections.csv").open("w", newline="") as stream:
                writer = csv.writer(stream)
                writer.writerow(["latitude", "longitude", "acq_date", "acq_time", "satellite", "instrument", "daynight", "frp", "confidence", "type"])
                tail = ["T" if modis else "N", "MODIS" if modis else "VIIRS"]
                confidence = "90" if modis else "n"
                writer.writerow([-18.5, -56.5, kwargs["start"], "0000", *tail, "N", 10, confidence, 0])
                writer.writerow([-18.5, -56.5, kwargs["start"], "1200", *tail, "D", 10, confidence, 0])
                writer.writerow([-22, -59, kwargs["start"], "1200", *tail, "D", 10, confidence, 0])
                writer.writerow([-18.5, -56.5, kwargs["start"], "1200", *tail, "D", 0, confidence, 0])
            payload = (output / "detections.csv").read_bytes()
            metadata = {"source": kwargs["source"], "sha256": hashlib.sha256(payload).hexdigest(), "row_count": 4,
                        "bytes": len(payload), "processing_level": "SP"}
            (output / "provenance.json").write_text(json.dumps(metadata))
            return metadata
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "2019"
            report = audit_year(year=2019, output=output, downloader=download, map_key="test-key", reference=REFERENCE)
            rows = [json.loads(line) for line in (output / "regional-records.jsonl").read_text().splitlines()]
            self.assertEqual(len(rows), 18)
            self.assertTrue(all(row["region_id"] == "pantanal_ibge_2025_reference" for row in rows))
            self.assertTrue(all("2019-08-01" <= row["local_solar_date"] <= "2019-08-15" for row in rows))
            self.assertTrue(any(row["acquired_at_utc"].startswith("2019-08-16") for row in rows))
            self.assertEqual(sum(row["quality_pass"] for row in rows), 12)
            self.assertEqual(sum(row["frp_mw"] == 0 for row in rows), 6)
            self.assertTrue(all(row["source_file_sha256"] and row["source_record"] for row in rows))
            self.assertEqual(report["duplicate_key_audit"]["rounding_scenarios"]["half_even"]["conflicting_quality_groups"], 6)
            self.assertFalse(report["deduplication_applied"])
