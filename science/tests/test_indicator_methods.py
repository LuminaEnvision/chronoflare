from datetime import date, timedelta
from pathlib import Path
import random
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from indicator_methods import (empirical_ratio_interval, combine_daily, duplicate_key, inverse_mae_weights, observed_turns, paired_iso_weeks, quality_then_deduplicate, training_sample_floor, winner_priority)
from normalize_detections import normalize_record
from solar_time import local_solar_date
from validation_preflight import Experiment


def detection(index=1, source_hash="a"*64, **changes):
    raw = {"latitude": "-18.5", "longitude": "-56.5", "acq_date": "2019-08-01", "acq_time": "1200", "satellite": "T", "instrument": "MODIS", "daynight": "D", "frp": "10", "confidence": "80", "type": "0", **changes}
    row = normalize_record(raw, raw, "MODIS_SP", source_hash, index)
    return {**row, "region_id": "pantanal_reference", "local_solar_date": local_solar_date(row["acquired_at_utc"])}


class IndicatorMethodsTests(unittest.TestCase):
    def test_quality_precedes_largest_frp(self):
        valid = detection()
        invalid = detection(2, frp="999", type="2")
        winners, audit = quality_then_deduplicate([invalid, valid])
        self.assertEqual(len(winners), 1)
        self.assertEqual(winners[0]["frp_mw"], 10)
        self.assertEqual(audit[0]["indicator_exclusion"], "quality_rejected")
        self.assertEqual(invalid["raw_record"]["frp"], "999")

    def test_largest_frp_then_confidence_then_stable_source_tie(self):
        rows = [detection(1, frp="10", confidence="100"), detection(3, frp="20", confidence="80"), detection(2, frp="20", confidence="90")]
        winner, audit = quality_then_deduplicate(rows)
        self.assertEqual(winner[0]["source_record"], 2)
        self.assertEqual(sum(row["indicator_exclusion"] == "duplicate_key" for row in audit), 2)
        clones = [detection(9, source_hash="b"*64), detection(3), detection(2)]
        for seed in range(5):
            random.Random(seed).shuffle(clones)
            winners, _ = quality_then_deduplicate(clones)
            self.assertEqual((winners[0]["source_file_sha256"], winners[0]["source_record"]), ("a"*64, 2))

    def test_sp_priority_does_not_enable_nrt_ingestion(self):
        sp, nrt = detection(), detection(2, frp="100")
        nrt["processing_level"] = "NRT"
        sp["confidence_class"] = nrt["confidence_class"] = "high"
        self.assertLess(winner_priority(sp), winner_priority(nrt))
        winners, audit = quality_then_deduplicate([nrt, sp])
        self.assertEqual(len(winners), 1)
        self.assertFalse(audit[0]["quality_pass"])

    def test_native_python_rounding_is_pinned_and_not_decimal_alias(self):
        row = detection(latitude="-18.000005")
        self.assertEqual(duplicate_key(row)[3], -18.00001)
        self.assertEqual(duplicate_key(detection(latitude="-18.000004"))[3], -18.0)
        self.assertNotEqual(duplicate_key(row), duplicate_key(detection(latitude="-18.000004")))

    def test_distinct_same_minute_pixels_and_turns_are_not_dropped(self):
        rows = [detection(), detection(2, latitude="-18.6"), detection(3, acq_time="0500", daynight="N")]
        winners, _ = quality_then_deduplicate(rows)
        self.assertEqual(len(winners), 3)
        cells = observed_turns(winners, "2019-08-01", "2019-08-01")
        day = next(row for row in cells if row["platform"] == "Terra" and row["day_night"] == "D")
        self.assertEqual(day["observed_detection_count"], 2)
        self.assertEqual(day["observed_frp_sum_mw"], 20.)
        missing = next(row for row in cells if row["platform"] == "Aqua")
        self.assertIsNone(missing["observed_frp_sum_mw"])
        self.assertEqual(missing["coverage_status"], "unknown")

    def test_stale_normalized_values_and_mixed_regions_fail(self):
        altered = detection(); altered["frp_mw"] = 50
        with self.assertRaises(ValueError): quality_then_deduplicate([altered])
        winners, _ = quality_then_deduplicate([detection(), detection(2, latitude="-18.6")])
        winners[1]["region_id"] = "another_region"
        with self.assertRaises(ValueError): observed_turns(winners, "2019-08-01", "2019-08-01")

    def test_missing_turn_cannot_become_complete_estimate(self):
        result = combine_daily({"D": 111., "N": None}, {"D": 100., "N": 28.})
        self.assertEqual(result, {"value": 128., "regime": "Aqua_only"})
        self.assertIsNone(combine_daily({"D": 111., "N": None}, {"D": None, "N": 28.})["value"])
        with self.assertRaises(ValueError): combine_daily({"D": 111.}, {"D": None, "N": None})
        with self.assertRaises(ValueError): combine_daily({"D": 1., "N": 0.}, {"D": None, "N": None})

    def test_illustrative_convex_combination_is_not_a_sum(self):
        result = combine_daily({"D": 90., "N": 21.}, {"D": 100., "N": 28.}, {"Terra": .35, "Aqua": .65})
        self.assertAlmostEqual(result["value"], 122.05)
        with self.assertRaises(ValueError): combine_daily({"D": 90., "N": 21.}, {"D": 100., "N": 28.})
        with self.assertRaises(ValueError): combine_daily({"D": 90., "N": 21.}, {"D": 100., "N": 28.}, {"Terra": 1., "Aqua": 1.})

    def test_regularized_weights_handle_zero_ties_and_extreme_errors(self):
        self.assertEqual(inverse_mae_weights(0, 0), {"Terra": .5, "Aqua": .5})
        self.assertEqual(inverse_mae_weights(1e308, 1e308), {"Terra": .5, "Aqua": .5})
        self.assertGreater(inverse_mae_weights(10, 1)["Aqua"], .9)
        for value in (-1, float("nan"), float("inf"), None):
            with self.assertRaises(ValueError): inverse_mae_weights(value, 1)

    def test_iso_weeks_use_same_paired_days_and_exclusive_end(self):
        rows = [{"solar_date": (date(2019,12,30)+timedelta(days=i)).isoformat(), "observed": 10., "estimated": 20.} for i in range(7)]
        rows[0]["observed"] = None; rows[6]["estimated"] = None
        week = paired_iso_weeks(rows, "2019-12-30", "2020-01-06")[0]
        self.assertEqual((week["iso_year"], week["iso_week"]), (2020, 1))
        self.assertEqual(week["period_end_exclusive"], "2020-01-06")
        self.assertEqual(week["paired_day_count"], 5)
        self.assertEqual(week["paired_daily_means"], {"observed": 10., "estimated": 20.})
        self.assertEqual(week["seven_day_equivalents"], {"observed": 70., "estimated": 140.})
        self.assertEqual(week["validation_statistic_selected"], "seven_day_equivalent")
        self.assertEqual(week["observation_coverage"], "unknown")

    def test_short_empty_or_invalid_weeks_do_not_create_zero_metrics(self):
        rows = [{"solar_date": f"2020-01-0{i}", "observed": 10., "estimated": 20.} for i in range(1,5)]
        week = paired_iso_weeks(rows, "2020-01-01", "2020-01-06")[0]
        self.assertFalse(week["eligible_weekly_support"])
        self.assertIsNone(week["paired_daily_means"]["observed"])
        empty = paired_iso_weeks([], "2020-01-01", "2020-01-06")[0]
        self.assertIsNone(empty["paired_sums_audit"]["observed"])
        with self.assertRaises(ValueError): paired_iso_weeks(rows + [rows[0]], "2020-01-01", "2020-01-06")

    def test_sample_floor_requires_distinct_training_dates_and_three_years(self):
        experiment = Experiment("2012-01-20", "2019-12-31", "2020-01-01", "2026-11-02")
        self.assertFalse(training_sample_floor(["2019-08-01"]*30, experiment)["meets_registered_sample_floor"])
        dates = [f"{year}-08-{day:02d}" for year in (2017,2018,2019) for day in range(1,11)]
        self.assertTrue(training_sample_floor(dates, experiment)["meets_registered_sample_floor"])
        with self.assertRaises(ValueError): training_sample_floor(["2020-08-01"], experiment)

    def test_interval_recipe_is_nominal_and_uses_supplied_quantiles_only(self):
        ordinary = empirical_ratio_interval(122.05, .72, 1.35)
        self.assertAlmostEqual(ordinary["uncertainty_lower"], 87.876)
        self.assertAlmostEqual(ordinary["uncertainty_upper"], 164.7675)
        inflated = empirical_ratio_interval(122.05, .72, 1.35, is_extrapolated=True)
        self.assertAlmostEqual(inflated["uncertainty_upper"] - inflated["uncertainty_lower"], 1.25 * (ordinary["uncertainty_upper"] - ordinary["uncertainty_lower"]))
        self.assertFalse(ordinary["fitted_by_this_function"])
        self.assertFalse(ordinary["coverage_guaranteed"])
        with self.assertRaises(ValueError): empirical_ratio_interval(100., 1.2, .9)
        with self.assertRaises(ValueError): empirical_ratio_interval(100., .1, .15, is_extrapolated=True)
