from datetime import date, timedelta
import json
from pathlib import Path
import sys
import tempfile
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import calibration_models_v2 as v2
from calibration_models import TrainingBlocked
from run_harmonization_v2 import freeze, score
from validation_preflight import Experiment

EXPERIMENT = Experiment("2013-01-01", "2019-12-31", "2020-01-01", "2021-12-31")


def controlled_cells():
    """Exact synthetic scales: S-NPP = 3x Terra = 1.5x Aqua; Terra night leads S-NPP night by one date."""
    cells = []
    for year in (2013, 2014, 2015, 2017, 2018, 2020, 2021, 2022, 2023):
        for month in (2, 8):
            for offset in range(-1, 31):
                day = date(year, month, 1) + timedelta(days=offset)
                base = float(10 + offset + 2)
                following = float(10 + offset + 3)
                for turn in ("D", "N"):
                    shift = 0. if turn == "D" else 3.
                    if offset >= 0:
                        cells.append({"solar_date": day.isoformat(), "platform": "S-NPP", "day_night": turn, "observed_frp_sum_mw": (base + shift) * 3})
                        cells.append({"solar_date": day.isoformat(), "platform": "Aqua", "day_night": turn, "observed_frp_sum_mw": (base + shift) * 2})
                    if turn == "D" and offset >= 0:
                        cells.append({"solar_date": day.isoformat(), "platform": "Terra", "day_night": "D", "observed_frp_sum_mw": base})
                    if turn == "N" and offset < 30:
                        # This Terra night value describes the NEXT solar date's S-NPP night.
                        cells.append({"solar_date": day.isoformat(), "platform": "Terra", "day_night": "N", "observed_frp_sum_mw": following + shift})
    return cells


class CalibrationModelsV2Tests(unittest.TestCase):
    def setUp(self):
        self.pairs = v2.build_pairs(controlled_cells(), "test-region")

    def test_terra_night_is_paired_with_the_following_solar_date_and_absence_stays_absent(self):
        terra_night = [r for r in self.pairs if (r["predictor_platform"], r["day_night"]) == ("Terra", "N")]
        self.assertTrue(terra_night)
        for row in terra_night:
            self.assertEqual(row["predictor_solar_date"], (date.fromisoformat(row["solar_date"]) - timedelta(days=1)).isoformat())
            self.assertAlmostEqual(row["reference_value"], 3 * row["predictor_value"])
        others = [r for r in self.pairs if (r["predictor_platform"], r["day_night"]) != ("Terra", "N")]
        self.assertTrue(all(r["predictor_solar_date"] == r["solar_date"] for r in others))
        cells = [{"solar_date": "2015-08-02", "platform": "S-NPP", "day_night": "N", "observed_frp_sum_mw": 9.},
                 {"solar_date": "2015-08-01", "platform": "Terra", "day_night": "N", "observed_frp_sum_mw": None},
                 {"solar_date": "2015-08-02", "platform": "Aqua", "day_night": "N", "observed_frp_sum_mw": 3.}]
        self.assertEqual([r["predictor_platform"] for r in v2.build_pairs(cells, "x")], ["Aqua"])
        with self.assertRaises(ValueError):
            v2.build_pairs(cells + cells[:1], "x")

    def test_every_candidate_extrapolates_beyond_the_training_range(self):
        rows = [{"solar_date": "2015-08-01", "predictor_value": float(i), "reference_value": 2. * i} for i in range(1, 201)]
        for method in v2.METHODS:
            model = v2.fit_method(rows, method)
            self.assertAlmostEqual(v2.predict_method(model, 5000.), 10000.)
            self.assertAlmostEqual(v2.predict_method(model, .5), 1.)
            self.assertEqual(model["training_max_predictor"], 200.)
        skewed = rows + [{"solar_date": "2015-08-01", "predictor_value": 1000., "reference_value": 10000.}]
        self.assertAlmostEqual(v2.fit_method(skewed, "ratio_of_sums")["scale"], (2 * 20100 + 10000) / (20100 + 1000))
        self.assertAlmostEqual(v2.fit_method(skewed, "median_ratio")["scale"], 2.)
        with self.assertRaises(ValueError):
            v2.fit_method(rows, "empirical_quantile_mapping")
        with self.assertRaises(TrainingBlocked):
            v2.fit_method([], "ratio_of_sums")

    def test_fit_uses_training_rows_only_and_recovers_exact_scales(self):
        model = v2.fit_experiment(self.pairs, EXPERIMENT)
        self.assertEqual(model["training_years"], ["2013", "2014", "2015", "2017", "2018"])
        self.assertFalse(model["harmonization_approved"])
        self.assertEqual(model["suite"]["method"], "ratio_of_sums")  # exact tie keeps the simplest candidate
        changed = [({**r, "reference_value": r["reference_value"] * 7} if r["solar_date"] >= "2020" else r) for r in self.pairs]
        self.assertEqual(v2.fit_experiment(changed, EXPERIMENT), model)
        predictions = v2.predict_experiment(model, self.pairs, EXPERIMENT)
        self.assertEqual(len(predictions["Combined_Terra_Aqua"]), 124)
        for view, rows in predictions.items():
            for row in rows:
                self.assertAlmostEqual(row["estimated"], row["observed"], places=6)
                self.assertFalse(row["is_extrapolated"])
                self.assertLessEqual(row["lower"], row["upper"])
        with self.assertRaises(ValueError):
            v2.predict_experiment(model, self.pairs, Experiment("2013-01-01", "2018-12-31", "2020-01-01", "2021-12-31"))

    def test_inputs_above_the_training_maximum_flag_the_day_and_widen_its_interval(self):
        model = v2.fit_experiment(self.pairs, EXPERIMENT)
        model["intervals"] = {key: {**value, "q10": .5, "q90": 2.} for key, value in model["intervals"].items()}
        large = [({**r, "predictor_value": r["predictor_value"] * 100, "reference_value": r["reference_value"] * 100}
                  if r["solar_date"] == "2020-08-10" else r) for r in self.pairs]
        rows = {r["solar_date"]: r for r in v2.predict_experiment(model, large, EXPERIMENT)["Combined_Terra_Aqua"]}
        flagged, normal = rows["2020-08-10"], rows["2020-08-11"]
        self.assertTrue(flagged["is_extrapolated"])
        self.assertFalse(normal["is_extrapolated"])
        self.assertAlmostEqual(flagged["estimated"], flagged["observed"], places=4)
        self.assertGreater((flagged["upper"] - flagged["lower"]) / flagged["estimated"], (normal["upper"] - normal["lower"]) / normal["estimated"])

    def test_insufficient_training_support_blocks_instead_of_fitting(self):
        with self.assertRaises(TrainingBlocked):
            v2.fit_experiment([r for r in self.pairs if r["solar_date"][:4] in ("2013", "2014", "2020")], EXPERIMENT)

    def test_freeze_then_score_is_hash_bound_single_use_and_never_approves(self):
        with tempfile.TemporaryDirectory() as temporary:
            observations = Path(temporary) / "observations.json"
            observations.write_text(json.dumps({"region_id": "test-region", "cells": controlled_cells()}))
            frozen = freeze(observations=observations, output=Path(temporary) / "v2")
            receipt = json.loads((Path(temporary) / "v2/freeze-receipt-v2.json").read_text())
            self.assertFalse(receipt["holdout_scoring_started"])
            with self.assertRaises(ValueError):
                freeze(observations=observations, output=Path(temporary) / "v2")
            with self.assertRaises(ValueError):
                score(observations=observations, frozen_dir=Path(temporary) / "v2", expected_sha256="0" * 64)
            summary = score(observations=observations, frozen_dir=Path(temporary) / "v2", expected_sha256=frozen["model_sha256"])
            self.assertEqual((summary["decision"], summary["harmonization_approved"], summary["independent_validation"]), ("plan_b", False, False))
            with self.assertRaises(ValueError):
                score(observations=observations, frozen_dir=Path(temporary) / "v2", expected_sha256=frozen["model_sha256"])

if __name__ == "__main__":
    unittest.main()
