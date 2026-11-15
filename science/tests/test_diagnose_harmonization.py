from pathlib import Path
import sys
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from diagnose_harmonization import ceiling_bound, cohort_selection, fit_idea, shifted_terra_night, turn_alignment
from validation_preflight import Experiment


def rows(count=200, scale=2.0):
    return [{"solar_date": "2015-08-01", "predictor_value": float(i), "reference_value": float(i) * scale} for i in range(1, count + 1)]


def cell(day, platform, turn, value):
    return {"solar_date": day, "platform": platform, "day_night": turn, "observed_frp_sum_mw": value}


class DiagnoseHarmonizationTests(unittest.TestCase):
    def test_clamped_eqm_saturates_while_scale_preserving_ideas_extrapolate(self):
        training = rows()
        self.assertLess(fit_idea(training, "eqm_clamp")(1000.), 400.)
        for idea in ("ratio_of_sums", "eqm_proportional_tail", "median_ratio"):
            self.assertAlmostEqual(fit_idea(training, idea)(1000.), 2000.)
        self.assertAlmostEqual(fit_idea(training, "eqm_proportional_tail")(0.5), 1.)
        self.assertEqual(fit_idea(training, "native")(7.), 7.)
        with self.assertRaises(ValueError):
            fit_idea(training, "unknown")

    def test_ceiling_bound_reports_the_tail_loss_from_endpoint_clamping(self):
        fitted = {"method": "empirical_quantile_mapping", "nodes": [[1., 1.], [10., 50.]]}
        model = {"suite": {"models": {f"{p}|{t}|dry": {"fitted": fitted} for p in ("Terra", "Aqua") for t in ("D", "N")}}}
        observed = {f"2020-08-{day:02d}": 400. for day in range(3, 10)}  # one full ISO week, far above the 100 MW ceiling
        evaluation = {view: {"paired_observed_values": observed, "weekly_metrics": {"pbias": -0.8}}
                      for view in ("Terra_only", "Aqua_only", "Combined_Terra_Aqua")}
        result = ceiling_bound(model, evaluation, Experiment("2012-01-01", "2019-12-31", "2020-01-01", "2020-12-31"))
        combined = result["views"]["Combined_Terra_Aqua"]
        self.assertEqual(combined["ceiling_mw"], 100.)
        self.assertEqual(combined["days_observed_above_ceiling"], 7)
        self.assertAlmostEqual(combined["weekly_pbias_if_exact_below_ceiling"], -0.75)

    def test_terra_night_shift_and_alignment_use_the_previous_solar_date(self):
        days = [f"2015-08-{day:02d}" for day in range(1, 9)]
        cells = []
        for index, day in enumerate(days):
            cells.append(cell(day, "Terra", "N", float(10 * (index + 1))))
            # S-NPP night mirrors the Terra night of the previous solar date.
            cells.append(cell(day, "S-NPP", "N", float(10 * index) if index else 5.))
        pairs = [{"solar_date": days[0], "predictor_platform": "Terra", "reference_platform": "S-NPP", "day_night": "N",
                  "metric": "frp_sum_mw", "predictor_value": 10., "reference_value": 5.},
                 {"solar_date": days[0], "predictor_platform": "Aqua", "reference_platform": "S-NPP", "day_night": "N",
                  "metric": "frp_sum_mw", "predictor_value": 3., "reference_value": 5.}]
        shifted = shifted_terra_night(cells, pairs)
        terra = [r for r in shifted if r["predictor_platform"] == "Terra"]
        self.assertEqual(len(terra), 7)
        self.assertTrue(all(r["predictor_value"] == r["reference_value"] for r in terra))
        self.assertEqual(sum(r["predictor_platform"] == "Aqua" for r in shifted), 1)
        alignment = next(r for r in turn_alignment(cells, days[0], days[-1]) if r["platform"] == "Terra" and r["day_night"] == "N")
        self.assertAlmostEqual(alignment["spearman_next_solar_date"], 1.)

    def test_cohort_selection_never_counts_absence_as_zero(self):
        cells = [cell("2015-08-01", "S-NPP", "D", 10.), cell("2015-08-01", "S-NPP", "N", 5.),
                 cell("2015-08-01", "Terra", "D", 4.), cell("2015-08-01", "Terra", "N", None)]
        result = cohort_selection(cells, "2015-01-01", "2015-12-31")
        self.assertEqual(result, [{"cohort": "snpp_day_and_night|modis_none_complete", "days": 1, "share_of_snpp_frp": 1.}])


if __name__ == "__main__":
    unittest.main()
