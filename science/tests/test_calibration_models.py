from copy import deepcopy
from datetime import date, timedelta
from pathlib import Path
import sys
import tempfile
import unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"scripts"))
from acquisition_plan import fingerprint
from calibration_models import TrainingBlocked, fit_candidate, fit_experiment, predict_candidate, predict_experiment, quantile
from multiyear_readiness import experiment_for, support_audit
from run_scientific_experiments import evaluate_reconstruction
from scientific_thresholds import load_thresholds


def controlled_pairs():
    """Exact synthetic ratio, used only to test training boundaries and arithmetic."""
    rows=[]
    for year in (2013,2014,2015,2017,2018,2020,2021):
        for month in (2,8):
            for offset in range(31):
                day=(date(year,month,1)+timedelta(days=offset)).isoformat()
                for platform in ("Terra","Aqua"):
                    for turn in ("D","N"):
                        base=float(10+offset+(0 if turn=="D" else 3))
                        rows.append({"region_id":"test-region","solar_date":day,"predictor_platform":platform,"reference_platform":"S-NPP",
                                     "day_night":turn,"metric":"frp_sum_mw","predictor_value":base*(1 if platform=="Terra" else 2),"reference_value":base*3})
    return rows


class CalibrationModelsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.thresholds=load_thresholds();cls.experiment=experiment_for(cls.thresholds,"forward_validation_primary")
        cls.pairs=controlled_pairs();cls.model=fit_experiment(cls.pairs,cls.experiment)

    def test_quantile_mapping_ties_endpoints_and_monotonicity(self):
        rows=[{"predictor_value":x,"reference_value":y} for x,y in ((1,2),(1,3),(2,4),(4,9))]
        eqm=fit_candidate(rows,"empirical_quantile_mapping")
        values=[predict_candidate(eqm,x) for x in (.1,1.,1.5,2.,4.,10.)]
        self.assertEqual(values,sorted(values));self.assertEqual(values[0],values[1]);self.assertEqual(values[-1],values[-2])
        self.assertEqual(quantile([1,3],.1),1.2)
        ratio=fit_candidate(rows,"median_ratio")
        self.assertEqual(ratio["alpha"],2.125)

    def test_holdout_targets_cannot_change_fitted_parameters(self):
        changed=deepcopy(self.pairs)
        for row in changed:
            if self.experiment.split(row["solar_date"])=="test":row["reference_value"]*=1000;row["predictor_value"]*=100
        second=fit_experiment(changed,self.experiment)
        self.assertEqual(fingerprint(second),fingerprint(self.model))
        self.assertTrue(all(day<"2020-01-01" for day in self.model["training_dates"]))
        for fold in self.model["nested_outer_folds"]:
            self.assertNotIn(fold["excluded_year"],fold["fitting_years"])

    def test_exact_ratio_convex_prediction_and_training_intervals(self):
        result=predict_experiment(self.model,self.pairs,self.experiment)
        for rows in result.values():
            self.assertTrue(rows)
            for row in rows:
                self.assertAlmostEqual(row["estimated"],row["observed"])
                self.assertAlmostEqual(row["lower"],row["observed"])
                self.assertAlmostEqual(row["upper"],row["observed"])
        self.assertAlmostEqual(sum(self.model["weight_fit"]["weights"].values()),1.)
        self.assertEqual(self.model["weight_fit"]["weights"],{"Terra":.5,"Aqua":.5})

    def test_insufficient_training_and_experiment_mismatch_block(self):
        with self.assertRaises(TrainingBlocked):fit_experiment([r for r in self.pairs if r["solar_date"].startswith("2013")],self.experiment)
        other=experiment_for(self.thresholds,"backward_transfer_validation")
        with self.assertRaises(ValueError):predict_experiment(self.model,self.pairs,other)

    def test_partial_acquisition_never_attempts_training(self):
        with tempfile.TemporaryDirectory() as directory:
            observed={"pairs":[],"source_entries":[],"complete_acquisition":False,"sample_readiness":support_audit([],self.thresholds)}
            result=evaluate_reconstruction(observed,Path(directory),source_reconstruction_sha256="synthetic-test-only")
            self.assertFalse(result["training_attempted"])
            self.assertEqual(result["evaluation_status"],"not_run")
            self.assertEqual(result["decision"],"plan_b")
            self.assertIsNone(result["empirical_metrics"])
            self.assertFalse((Path(directory)/"frozen-models.json").exists())

    def test_full_controlled_run_freezes_both_models_before_scoring(self):
        from test_scientific_thresholds import synthetic_evidence
        import json
        pairs,_=synthetic_evidence()
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)
            observed={"pairs":pairs,"source_entries":[],"complete_acquisition":True,"sample_readiness":support_audit(pairs,self.thresholds)}
            result=evaluate_reconstruction(observed,root,source_reconstruction_sha256="controlled-synthetic-fixture")
            self.assertEqual(result["evaluation_status"],"completed")
            self.assertEqual(len(result["completed_frozen_experiments"]),2)
            self.assertTrue((root/"frozen-models.json").exists())
            receipt=json.loads((root/"freeze-receipt.json").read_text())
            self.assertFalse(receipt["holdout_scoring_started"])
            self.assertFalse(result["application_publication_performed"])
            # An exact synthetic predictor overcovers: nominal 80% is not approval.
            self.assertEqual(result["decision"],"plan_b")


    def test_pooled_sample_support_cannot_approve_an_unsupported_seasonal_model(self):
        from run_scientific_experiments import fitted_scope_support
        reduced=[r for r in self.pairs if self.experiment.split(r["solar_date"])!="test" or r["solar_date"][5:7]!="02"]
        result=fitted_scope_support(self.model,reduced,self.experiment,self.thresholds)
        self.assertFalse(result["all_fitted_scopes_eligible"])
        self.assertTrue(any(not row["eligible"] and row["fitted_stratum"].endswith("wet") for row in result["rows"]))
