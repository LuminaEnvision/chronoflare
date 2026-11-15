from collections import Counter
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
