from datetime import date, timedelta
import json
from pathlib import Path
import sys
import tempfile
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import acquisition_plan
import independent_holdout as holdout
from acquire_multiyear import acquire as acquire_frozen
from run_harmonization_v2 import score_independent
from test_acquire_multiyear import fake_download

EVIDENCE = Path(__file__).resolve().parents[2] / "docs/multiyear-evidence/v2-candidate"


def registered(directory, **changes):
    data = {**holdout.expected_registration(), "status": "registered", "registered_by": "Test owner", "registered_at_utc": "2026-11-15T18:00:00Z",
            "decisions": {"accept_v2_candidate_unchanged": True, "accept_terra_night_alignment": True,
                          "backward_rule": "test rule", "insufficient_support_policy": "plan_b"}}
    data.update(changes)
    path = Path(directory) / "registration.json"
    path.write_text(json.dumps(data))
    return path


class IndependentHoldoutTests(unittest.TestCase):
    def test_plan_is_frozen_and_disjoint_from_every_examined_date(self):
        plan = holdout.load_plan()
        dates = holdout.holdout_dates(plan)
        examined = {day.isoformat() for day in holdout.examined_dates()}
        self.assertFalse(dates & examined)
        self.assertEqual(len(dates), plan["solar_date_count"])
        self.assertEqual((min(dates), max(dates)), ("2020-01-01", "2026-11-02"))
        window = {(date(2020, 1, 1) + timedelta(days=offset)).isoformat() for offset in range((date(2026, 11, 2) - date(2020, 1, 1)).days + 1)}
        self.assertEqual(dates | (examined & window), window)
        frozen_ids = {request["id"] for request in acquisition_plan.build_plan()["requests"]}
        ids = [request["id"] for request in plan["requests"]]
        self.assertEqual(len(ids), len(set(ids)))
        self.assertFalse(set(ids) & frozen_ids)
        self.assertTrue(all(request["days"] <= 5 and request["source"] in acquisition_plan.SOURCES for request in plan["requests"]))
        self.assertEqual(acquisition_plan.load_plan(acquisition_plan.Path(holdout.PROJECT / "science/configs/acquisition_plan.json")), acquisition_plan.build_plan())
        with tempfile.TemporaryDirectory() as temporary:
            changed = Path(temporary) / "plan.json"
            changed.write_text(json.dumps({**plan, "window": ["2019-01-01", "2026-11-02"]}))
            with self.assertRaises(ValueError):
                holdout.load_plan(changed)

    def test_nothing_runs_without_a_complete_matching_registration(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            with self.assertRaises(ValueError):
                holdout.acquire(cache=root / "cache", max_new_requests=1, registration=root / "absent.json", downloader=fake_download, sleep=lambda _: None)
            self.assertFalse((root / "cache").exists())
            proposed = json.loads((holdout.PROJECT / "science/configs/independent_holdout.registration.proposed.json").read_text())
            (root / "proposed.json").write_text(json.dumps(proposed))
            for path in (root / "proposed.json", registered(root, candidate_model_sha256="0" * 64), registered(root, registered_by=" "),
                         registered(root, decisions={"accept_v2_candidate_unchanged": True, "accept_terra_night_alignment": False,
                                                     "backward_rule": "x", "insufficient_support_policy": "y"})):
                with self.assertRaises(ValueError):
                    holdout.load_registration(path)
            self.assertEqual(holdout.load_registration(registered(root))["status"], "registered")
        self.assertFalse(holdout.REGISTRATION.exists(), "Only the scientific owner may add the registration")

    def test_registered_acquisition_and_reconstruction_use_only_the_holdout_plan(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            registration = registered(root)
            report = holdout.acquire(cache=root / "cache", max_new_requests=14, registration=registration, downloader=fake_download, sleep=lambda _: None)
            self.assertEqual((report["completed_requests"], report["planned_requests"], report["complete"]), (14, 790, False))
            self.assertEqual(json.loads((root / "cache/plan.json").read_text()), holdout.build_plan())
            with self.assertRaises(ValueError):
                acquire_frozen(root=root / "cache", max_new_requests=0, downloader=fake_download, sleep=lambda _: None)
            result = holdout.reconstruct(cache=root / "cache", output=root / "observed", registration=registration)
            self.assertEqual(result["completed_blocks"], ["holdout-2020-01-01"])
            self.assertEqual(len(result["cells"]), 31 * 6)
            self.assertTrue(all(cell["observed_frp_sum_mw"] is None for cell in result["cells"]))
            import multiyear_readiness
            self.assertIs(multiyear_readiness.load_plan, acquisition_plan.load_plan)

    def test_independent_score_is_registered_single_use_and_never_approves(self):
        plan = holdout.load_plan()
        days = sorted(holdout.holdout_dates(plan))[:40]
        cells = [{"solar_date": day, "platform": platform, "day_night": turn, "observed_frp_sum_mw": 30. + index + (5. if turn == "N" else 0.)}
                 for index, day in enumerate(days) for platform in ("Terra", "Aqua", "S-NPP") for turn in ("D", "N")]
        frozen = json.loads((EVIDENCE / "frozen-models-v2.json").read_text())
        sha = holdout.expected_registration()["candidate_model_sha256"]
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            examined = root / "observations.json"
            examined.write_text(json.dumps({"region_id": plan["region_id"], "cells": []}))
            observed = root / "holdout.json"
            base = {"plan_fingerprint": holdout.fingerprint(plan), "region_id": plan["region_id"], "cells": cells,
                    "completed_blocks": ["holdout-2020-01-01"], "missing_blocks": []}
            observed.write_text(json.dumps(base))
            arguments = dict(observations=examined, holdout_observations=observed, frozen_dir=EVIDENCE, expected_sha256=sha)
            with self.assertRaises(ValueError):  # not registered
                score_independent(**arguments, output=root / "a", registration=root / "absent.json")
            with self.assertRaises(ValueError):  # training observations differ from the frozen candidate
                score_independent(**arguments, output=root / "b", registration=registered(root))
            self.assertFalse((root / "b").exists())
            self.assertNotEqual(frozen["observations_sha256"], "")
            import run_harmonization_v2 as runner
            original = runner.file_hash
            runner.file_hash = lambda path: frozen["observations_sha256"] if Path(path) == examined else original(path)
            try:
                outside = root / "outside.json"
                outside.write_text(json.dumps({**base, "cells": cells + [{**cells[0], "solar_date": "2020-08-15"}]}))
                with self.assertRaises(ValueError):
                    score_independent(**{**arguments, "holdout_observations": outside}, output=root / "c", registration=registered(root))
                summary = score_independent(**arguments, output=root / "d", registration=registered(root))
                with self.assertRaises(ValueError):
                    score_independent(**arguments, output=root / "d", registration=registered(root))
            finally:
                runner.file_hash = original
                self.assertTrue(summary["independent_validation"])
                self.assertFalse(summary["harmonization_approved"])
                evaluation = summary["empirical_metrics"]["forward_validation_primary"]["Combined_Terra_Aqua"]
                self.assertEqual(evaluation["paired_daily_count"], 40)
                predictions = json.loads((root / "d/independent-predictions-v2.json").read_text())["Combined_Terra_Aqua"]
                # The first date has no previous Terra night, so it falls back to Aqua alone.
                self.assertEqual([row["regime"] for row in predictions[:2]], ["Aqua_only", "Terra+Aqua_weighted"])
                self.assertFalse(summary["all_registered_forward_combined_checks_met"])  # too few days and weeks


if __name__ == "__main__":
    unittest.main()
