from copy import deepcopy
from datetime import date, timedelta
import json
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from scientific_thresholds import CONFIG, assess_strata, average_ranks, evaluate_predictions, load_thresholds, select_plan, weekly_error_metrics, write_current_readiness

PROJECT = Path(__file__).resolve().parents[2]


def synthetic_evidence():
    """Controlled acceptance fixture only; never empirical project results."""
    pairs = []
    by_date = {}
    for year in (2012,2013,2014,2017,2018,2019,2020,2021):
        for month in (1,7):
            for offset in range(70):
                day = date(year, month, 6) + timedelta(days=offset)
                observed = float(100 + day.toordinal() % 100)
                by_date[day.isoformat()] = observed
                for platform in ("Terra","Aqua"):
                    for turn in ("D","N"):
                        pairs.append({"solar_date":day.isoformat(),"predictor_platform":platform,"reference_platform":"S-NPP","day_night":turn,"metric":"frp_sum_mw","predictor_value":observed/3,"reference_value":observed/2})
    return pairs, by_date


def predictions(thresholds, experiment, values):
    window = thresholds["temporal_splits"][experiment]["test_period_out_of_sample"]
    rows = []
    for day, observed in sorted(values.items()):
        if window["start_solar_date"] <= day <= window["end_solar_date"]:
            cover = date.fromisoformat(day).toordinal() % 5 != 0
            rows.append({"solar_date":day,"observed":observed,"estimated":observed+2,"lower":observed*.9 if cover else observed+1,"upper":observed*1.1,"naive":observed*2,"complete_turn_support":True})
    return rows


class ScientificThresholdTests(unittest.TestCase):
    def setUp(self): self.thresholds = load_thresholds()

    def test_registration_receipt_and_numeric_values(self):
        self.assertEqual(self.thresholds["registered_at_utc"],"2026-11-15T01:57:00Z")
        self.assertEqual(self.thresholds["weekly_aggregation_rules"]["weekly_metric_aggregation"],"mean_of_valid_paired_days")
        self.assertEqual(self.thresholds["minimum_sample_requirements"]["per_stratum"]["min_test_distinct_years"],2)
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)
            (root/"thresholds.json").write_bytes(CONFIG.read_bytes()+b" ")
            (root/"thresholds.receipt.json").write_bytes(CONFIG.with_name("thresholds.receipt.json").read_bytes())
            with self.assertRaises(ValueError): load_thresholds(root/"thresholds.json")

    def test_average_rank_spearman_and_bias_denominators(self):
        self.assertEqual(average_ranks([10,10,20]),[1.5,1.5,3.])
        result=weekly_error_metrics([1,1,3],[2,2,6])
        self.assertAlmostEqual(result["spearman"],1.)
        self.assertAlmostEqual(result["pbias"],1.)
        self.assertAlmostEqual(result["relative_mae"],1.)
        self.assertEqual(weekly_error_metrics([1,2,3],[3,2,1])["spearman"],-1.)

    def test_constant_empty_and_zero_denominator_are_not_perfect_scores(self):
        self.assertIsNone(weekly_error_metrics([1,1],[2,3])["spearman"])
        zero=weekly_error_metrics([0,0],[1,2])
        self.assertEqual(zero["status"],"insufficient_activity")
        self.assertIsNone(zero["pbias"])
        self.assertIsNone(zero["relative_mae"])
        self.assertEqual(weekly_error_metrics([],[])["status"],"not_run")
        with self.assertRaises(ValueError): weekly_error_metrics([1],[float("nan")])

    def test_controlled_predicted_series_passes_registered_checks(self):
        _, values=synthetic_evidence()
        result=evaluate_predictions(predictions(self.thresholds,"forward_validation_primary",values),self.thresholds,"forward_validation_primary","Combined_Terra_Aqua")
        self.assertEqual(result["status"],"checks_passed")
        self.assertGreaterEqual(result["eligible_week_count"],25)
        self.assertTrue(all(result["checks"].values()))
        self.assertAlmostEqual(result["weekly_metrics"]["mae"],2.)

    def test_missing_naive_or_interval_cannot_improve_by_dropping_days(self):
        _, values=synthetic_evidence(); rows=predictions(self.thresholds,"forward_validation_primary",values)
        original=evaluate_predictions(rows,self.thresholds,"forward_validation_primary","Combined_Terra_Aqua")
        rows[2]["naive"]=None; rows[3]["lower"]=None
        result=evaluate_predictions(rows,self.thresholds,"forward_validation_primary","Combined_Terra_Aqua")
        self.assertEqual(result["paired_daily_count"],original["paired_daily_count"])
        self.assertFalse(result["checks"]["improves_naive_same_cohort"])
        self.assertFalse(result["checks"]["picp"])
        self.assertIsNone(result["picp_daily"])

    def test_interval_too_wide_and_overcoverage_fail(self):
        _, values=synthetic_evidence(); rows=predictions(self.thresholds,"forward_validation_primary",values)
        for row in rows: row["lower"]=0.; row["upper"]=row["estimated"]*10
        result=evaluate_predictions(rows,self.thresholds,"forward_validation_primary","Combined_Terra_Aqua")
        self.assertFalse(result["checks"]["picp"])
        self.assertFalse(result["checks"]["relative_interval_width"])

    def test_bad_prediction_scope_turns_and_duplicate_dates_fail(self):
        _, values=synthetic_evidence(); rows=predictions(self.thresholds,"forward_validation_primary",values)
        for change in ({"solar_date":"2019-12-31"},{"complete_turn_support":False},{"lower":1000,"upper":1}):
            altered=deepcopy(rows[:1]); altered[0].update(change)
            with self.assertRaises(ValueError): evaluate_predictions(altered,self.thresholds,"forward_validation_primary","Combined_Terra_Aqua")
        with self.assertRaises(ValueError): evaluate_predictions([rows[0],rows[0]],self.thresholds,"forward_validation_primary","Combined_Terra_Aqua")

    def test_source_specific_thresholds_and_backward_picp(self):
        _, values=synthetic_evidence()
        backward=evaluate_predictions(predictions(self.thresholds,"backward_transfer_validation",values),self.thresholds,"backward_transfer_validation","Combined_Terra_Aqua")
        self.assertIn("picp",backward["checks"])
        self.assertNotIn("relative_mae",backward["checks"])
        self.assertNotIn("relative_interval_width",backward["checks"])
        limits=self.thresholds["acceptance_thresholds"]["forward_validation_primary"]
        self.assertEqual(limits["percent_bias_max_abs"]["terra_only"],.30)
        self.assertEqual(limits["percent_bias_max_abs"]["aqua_only"],.25)

    def test_real_samples_fail_year_floors_even_after_season_collapse(self):
        source=json.loads((PROJECT/"docs/indicator-observations/summary.json").read_text())
        pairs=[row for result in source["forward_pairing"].values() for row in result["pairs"]]
        support=assess_strata(pairs,self.thresholds,"forward_validation_primary")
        self.assertFalse(support["all_required_strata_eligible"])
        self.assertTrue(all(not row["eligible"] for row in support["rows"]))
        self.assertTrue(all(row["test_years"]<=1 for row in support["rows"]))
        decision=select_plan(None,None,pairs)
        self.assertEqual(decision["decision"],"plan_b")
        self.assertFalse(decision["harmonization_approved"])

    def test_plan_a_requires_complete_checks_cohort_and_provenance(self):
        pairs, values=synthetic_evidence()
        forward=evaluate_predictions(predictions(self.thresholds,"forward_validation_primary",values),self.thresholds,"forward_validation_primary","Combined_Terra_Aqua")
        backward=evaluate_predictions(predictions(self.thresholds,"backward_transfer_validation",values),self.thresholds,"backward_transfer_validation","Combined_Terra_Aqua")
        self.assertEqual(select_plan(forward,backward,pairs)["decision"],"plan_b")
        self.assertEqual(select_plan(forward,backward,pairs,provenance_verified=True)["decision"],"plan_a")
        altered=deepcopy(forward); altered["checks"]={"fake":True}
        self.assertEqual(select_plan(altered,backward,pairs,provenance_verified=True)["decision"],"plan_b")
        altered=deepcopy(forward); altered["paired_dates"].pop()
        self.assertEqual(select_plan(altered,backward,pairs,provenance_verified=True)["decision"],"plan_b")
        altered=deepcopy(forward); altered["thresholds_fingerprint"]="bad"
        self.assertEqual(select_plan(altered,backward,pairs,provenance_verified=True)["decision"],"plan_b")

    def test_current_readiness_outputs_are_explicit_plan_b_without_empirical_failure(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)/"report"
            report=write_current_readiness(observations=PROJECT/"docs/indicator-observations/summary.json",output=root)
            self.assertEqual(report["decision"],"plan_b")
            self.assertEqual(report["evaluation_status"],"not_run")
            self.assertIsNone(report["empirical_metrics"])
            self.assertFalse(json.loads((root/"manifest.json").read_text())["harmonization_approved"])
            with self.assertRaises(ValueError): write_current_readiness(observations=PROJECT/"docs/indicator-observations/summary.json",output=root)

    def test_weekly_pbias_is_not_replaced_by_unequal_daily_weighting(self):
        rows=[]
        for start,count,observed,estimated in ((date(2020,1,6),5,10.,20.),(date(2020,1,13),7,100.,100.)):
            for offset in range(count):
                rows.append({"solar_date":(start+timedelta(days=offset)).isoformat(),"observed":observed,"estimated":estimated,"lower":0.,"upper":200.,"naive":200.,"complete_turn_support":True})
        result=evaluate_predictions(rows,self.thresholds,"forward_validation_primary","Combined_Terra_Aqua")
        self.assertAlmostEqual(result["weekly_metrics"]["pbias"],10/110)
        self.assertAlmostEqual(result["daily_error_diagnostics"]["pbias"],50/750)
        self.assertNotAlmostEqual(result["weekly_metrics"]["pbias"],result["daily_error_diagnostics"]["pbias"])
        self.assertEqual(result["weekly_statistic"],"mean_of_valid_paired_days")
