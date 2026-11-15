import json
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from validation_preflight import (Experiment, TurnObservation, assert_training_only, experiment_from_protocol, pair_observations, preview_readiness, write_readiness)

PROJECT = Path(__file__).resolve().parents[2]
PROTOCOL = PROJECT / "science/configs/indicator_protocol.review.json"
PREVIEW = PROJECT / "app/public/data/experimental/v1/pantanal-solar.json"


def observation(**changes):
    return TurnObservation(**{"region_id": "pantanal", "solar_date": "2019-08-01", "platform": "Terra", "day_night": "D",
                              "metric": "frp_sum_mw", "value": 10., "dataset_version": "synthetic-test-only",
                              "quality_rule_version": "test-quality-v1", "dedup_rule_version": "test-dedup-v1", **changes})


class ValidationPreflightTests(unittest.TestCase):
    def setUp(self):
        self.protocol = json.loads(PROTOCOL.read_text())
        self.forward = experiment_from_protocol(self.protocol, "forward")

    def test_forward_endpoints_do_not_leak(self):
        for day, expected in [("2012-01-19", "outside"), ("2012-01-20", "train"), ("2019-12-31", "train"), ("2020-01-01", "test"), ("2026-11-02", "test"), ("2026-11-03", "outside")]:
            self.assertEqual(self.forward.split(day), expected)

    def test_backward_is_an_independent_explicit_experiment(self):
        backward = experiment_from_protocol(self.protocol, "backward_proxy")
        self.assertEqual(backward.split("2015-12-31"), "test")
        self.assertEqual(backward.split("2016-01-01"), "train")
        with self.assertRaises(ValueError):
            experiment_from_protocol(self.protocol, "noaa20_sanity")

    def test_overlapping_or_invalid_windows_are_rejected(self):
        for windows in [("2019-01-01", "2020-01-01", "2020-01-01", "2021-01-01"), ("2019-08-02", "2019-08-01", "2020-01-01", "2021-01-01"), ("2019-02-29", "2019-12-31", "2020-01-01", "2021-01-01")]:
            with self.assertRaises(ValueError):
                Experiment(*windows)
        with self.assertRaises(ValueError):
            self.forward.split("2020-8-1")

    def test_pairing_requires_same_date_turn_metric_and_region(self):
        result = pair_observations([observation(), observation(platform="S-NPP", value=12.)], "Terra", "S-NPP", self.forward)
        self.assertEqual(len(result["pairs"]), 1)
        self.assertEqual(result["pairs"][0]["reference_value"], 12.)
        self.assertFalse(result["fit_performed"])
        self.assertFalse(result["validation_performed"])
        for mismatch in ({"day_night": "N"}, {"region_id": "another-region"}, {"solar_date": "2019-08-02"}, {"metric": "detection_count", "value": 12}):
            result = pair_observations([observation(), observation(**{"platform": "S-NPP", **mismatch})], "Terra", "S-NPP", self.forward)
            self.assertEqual(result["pairs"], [])
            self.assertEqual(len(result["excluded"]), 2)

    def test_missing_reference_is_reported_not_zero_filled(self):
        result = pair_observations([observation()], "Terra", "S-NPP", self.forward)
        self.assertEqual(result["pairs"], [])
        self.assertEqual(result["excluded"][0]["reasons"], ["missing_reference_group"])
        result = pair_observations([observation(), observation(platform="S-NPP", value=None)], "Terra", "S-NPP", self.forward)
        self.assertEqual(result["excluded"][0]["reasons"], ["null_reference"])

    def test_duplicate_groups_and_version_mixing_fail(self):
        with self.assertRaises(ValueError):
            pair_observations([observation(), observation()], "Terra", "S-NPP", self.forward)
        for key in ("dataset_version", "quality_rule_version", "dedup_rule_version"):
            with self.assertRaises(ValueError):
                pair_observations([observation(), observation(**{"platform": "S-NPP", key: "different"})], "Terra", "S-NPP", self.forward)

    def test_unsupported_platform_combinations_do_not_enter_training(self):
        with self.assertRaises(ValueError):
            pair_observations([observation(platform="Aqua")], "Terra", "S-NPP", self.forward)
        with self.assertRaises(ValueError):
            pair_observations([], "NOAA-20", "S-NPP", self.forward)

    def test_held_out_pairs_are_explicit_and_refused_for_fitting(self):
        pairs = pair_observations([observation(solar_date="2020-08-01"), observation(platform="S-NPP", solar_date="2020-08-01")], "Terra", "S-NPP", self.forward)["pairs"]
        self.assertEqual(pairs[0]["split"], "test")
        with self.assertRaises(ValueError):
            assert_training_only(pairs, self.forward)
        pairs[0]["split"] = "train"
        with self.assertRaises(ValueError):
            assert_training_only(pairs, self.forward)
        with self.assertRaises(ValueError):
            assert_training_only([], self.forward)
        valid = pair_observations([observation(), observation(platform="S-NPP")], "Terra", "S-NPP", self.forward)["pairs"]
        assert_training_only(valid, self.forward)

    def test_outside_rows_are_excluded_with_reasons(self):
        result = pair_observations([observation(solar_date="2011-08-01"), observation(platform="S-NPP", solar_date="2011-08-01")], "Terra", "S-NPP", self.forward)
        self.assertEqual(result["pairs"], [])
        self.assertEqual(result["excluded"][0]["reasons"], ["outside_experiment"])

    def test_invalid_values_and_missing_processing_versions_fail(self):
        for value in (0, -1, float("nan"), float("inf"), True):
            with self.assertRaises(ValueError):
                observation(value=value)
        for patch in ({"day_night": ""}, {"dedup_rule_version": ""}, {"metric": "detection_count", "value": 1.5}):
            with self.assertRaises(ValueError):
                observation(**patch)

    def test_actual_preview_is_inventory_only_with_no_invented_validation(self):
        result = preview_readiness(json.loads(PREVIEW.read_text()), self.protocol)
        self.assertEqual(result["distinct_solar_dates"], 15)
        self.assertEqual(result["experiments"]["forward"]["distinct_solar_dates"], {"train": 0, "test": 15, "outside": 0})
        self.assertEqual(result["experiments"]["backward_proxy"]["distinct_solar_dates"], {"train": 15, "test": 0, "outside": 0})
        self.assertEqual(result["season_date_counts"], {"dry": 15, "wet": 0})
        self.assertIn("preview_has_no_day_night_aggregates", result["blockers"])
        self.assertIn("no_wet_season_dates", result["blockers"])
        self.assertFalse(result["fit_allowed"])
        self.assertFalse(result["approval_allowed"])
        self.assertNotIn("unregistered_validation_thresholds", result["blockers"])
        self.assertIsNone(result["paired_observations"])
        self.assertFalse(result["harmonization_approved"])
        self.assertTrue(all(view["mae"] is None and view["status"] == "not_run" for view in result["results_by_view"].values()))

    def test_report_has_input_hashes_and_refuses_overwrite(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "readiness.json"
            result = write_readiness(preview=PREVIEW, protocol=PROTOCOL, output=output)
            self.assertEqual(len(result["input_sha256"]["preview"]), 64)
            self.assertEqual(json.loads(output.read_text()), result)
            with self.assertRaises(ValueError):
                write_readiness(preview=PREVIEW, protocol=PROTOCOL, output=output)
