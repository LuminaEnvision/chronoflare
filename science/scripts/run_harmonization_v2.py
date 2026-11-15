"""Freeze the v2 harmonization candidate, then (separately) score it once.

`freeze` fits both experiments from training rows only and writes a hashed model plus a
receipt. `score` refuses to run unless that hash still matches, and labels its report as
post-hoc: the registered holdouts were already examined when v2 was designed, so this
score is NOT an independent validation and can never approve harmonization or change
the Plan B decision recorded for the frozen v1 models.
"""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path

from acquire_multiyear import PROJECT, write_json
from calibration_models_v2 import ENGINE_VERSION, build_pairs, fit_experiment, predict_experiment
from calibration_models import VIEWS
from normalize_detections import file_hash
from scientific_thresholds import evaluate_predictions, load_thresholds, threshold_fingerprint
from validation_preflight import Experiment

NAMES = ("forward_validation_primary", "backward_transfer_validation")
CODE = ("calibration_models_v2.py", "run_harmonization_v2.py", "calibration_models.py", "indicator_methods.py", "scientific_thresholds.py")
NOTICE = ("Post-hoc check of a revised candidate on holdouts that were already examined. Not an independent validation; "
          "harmonization stays unapproved and the registered Plan B decision is unchanged.")


def experiment_for(thresholds, name):
    section = thresholds["temporal_splits"][name]
    return Experiment(section["train_period"]["start_solar_date"], section["train_period"]["end_solar_date"],
                      section["test_period_out_of_sample"]["start_solar_date"], section["test_period_out_of_sample"]["end_solar_date"])


def load_pairs(observations):
    source = json.loads(observations.read_text())
    return build_pairs(source["cells"], source["region_id"])


def freeze(*, observations, output):
    output = output.resolve()
    if output.exists():
        raise ValueError("Choose a new output directory; a frozen candidate is never overwritten")
    thresholds = load_thresholds()
    pairs = load_pairs(observations)
    models = {name: fit_experiment(pairs, experiment_for(thresholds, name)) for name in NAMES}
    frozen = {"schema_version": "frozen-scientific-models/2.0.0-candidate", "engine_version": ENGINE_VERSION,
              "thresholds_fingerprint": threshold_fingerprint(thresholds), "observations_sha256": file_hash(observations),
              "models": models, "code_sha256": {name: file_hash(PROJECT / "science/scripts" / name) for name in CODE},
              "application_release": False, "harmonization_approved": False}
    output.mkdir(parents=True)
    write_json(output / "frozen-models-v2.json", frozen)
    receipt = {"frozen_at_utc": datetime.now(timezone.utc).isoformat(), "model_sha256": file_hash(output / "frozen-models-v2.json"),
               "observations_sha256": frozen["observations_sha256"], "thresholds_fingerprint": frozen["thresholds_fingerprint"],
               "holdout_scoring_started": False, "notice": NOTICE}
    write_json(output / "freeze-receipt-v2.json", receipt)
    return {"model_sha256": receipt["model_sha256"],
            "selected": {name: {"method": model["suite"]["method"], "weights": model["weight_fit"]["weights"],
                                "candidate_oof_weekly": model["candidate_oof_weekly"]} for name, model in models.items()}}


def score(*, observations, frozen_dir, expected_sha256):
    frozen_dir = frozen_dir.resolve()
    model_path = frozen_dir / "frozen-models-v2.json"
    receipt = json.loads((frozen_dir / "freeze-receipt-v2.json").read_text())
    if (frozen_dir / "post-hoc-summary-v2.json").exists():
        raise ValueError("This frozen candidate was already scored; it is scored once")
    thresholds = load_thresholds()
    if (file_hash(model_path) != expected_sha256 or receipt["model_sha256"] != expected_sha256
            or receipt["observations_sha256"] != file_hash(observations) or receipt["thresholds_fingerprint"] != threshold_fingerprint(thresholds)):
        raise ValueError("Frozen candidate, observations or thresholds differ from the receipt")
    frozen = json.loads(model_path.read_text())
    pairs = load_pairs(observations)
    evaluations = {}
    for name in NAMES:
        predictions = predict_experiment(frozen["models"][name], pairs, experiment_for(thresholds, name))
        write_json(frozen_dir / (name + "-predictions-v2.json"), predictions)
        evaluations[name] = {view: evaluate_predictions(predictions[view], thresholds, name, view) for view in VIEWS}
    summary = {"schema_version": "post-hoc-candidate-report/2.0.0", "engine_version": ENGINE_VERSION, "frozen_models_sha256": expected_sha256,
               "evaluation_kind": "post_hoc_on_previously_examined_holdouts", "independent_validation": False,
               "empirical_metrics": evaluations, "decision": "plan_b", "harmonization_approved": False, "notice": NOTICE}
    write_json(frozen_dir / "post-hoc-summary-v2.json", summary)
    return summary


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    for name in ("freeze", "score"):
        command = commands.add_parser(name)
        command.add_argument("--observations", type=Path, required=True, help="source-reconstruction/observations.json from the evidence artifact")
    commands.choices["freeze"].add_argument("--output", type=Path, required=True)
    commands.choices["score"].add_argument("--frozen-dir", type=Path, required=True)
    commands.choices["score"].add_argument("--expected-sha256", required=True, help="Model hash committed before scoring")
    args = parser.parse_args()
    if args.command == "freeze":
        print(json.dumps(freeze(observations=args.observations, output=args.output), indent=2))
        return
    summary = score(observations=args.observations, frozen_dir=args.frozen_dir, expected_sha256=args.expected_sha256)
    for name, views in summary["empirical_metrics"].items():
        for view, result in views.items():
            print(name, view, result["status"], json.dumps(result["weekly_metrics"]), json.dumps(result["checks"]))
    print(NOTICE)


if __name__ == "__main__":
    main()
