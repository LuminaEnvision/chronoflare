"""Rebuild trusted inputs, freeze training-only models, then score both holdouts."""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path

from acquisition_plan import fingerprint
from acquire_multiyear import PROJECT, write_json
from calibration_models import ENGINE_VERSION, TrainingBlocked, VIEWS, fit_experiment, predict_experiment
from multiyear_readiness import experiment_for, reconstruct
from normalize_detections import file_hash
from scientific_thresholds import CONFIG, evaluate_predictions, load_thresholds, select_plan, threshold_fingerprint

NAMES=("forward_validation_primary","backward_transfer_validation")


def evaluate_reconstruction(observed,output,*,source_reconstruction_sha256):
    """Called only after source reconstruction; this function never releases app data."""
    thresholds=load_thresholds();fitted={};evaluations={};reasons=[]
    ready=observed["complete_acquisition"] and observed["sample_readiness"]["all_samples_sufficient"]
    attempted=False
    if not observed["complete_acquisition"]:reasons.append("acquisition_incomplete")
    if not observed["sample_readiness"]["all_samples_sufficient"]:reasons.append("registered_samples_insufficient")
    pairs=observed["pairs"]
    if ready:
        for name in NAMES:
            attempted=True
            try: fitted[name]=fit_experiment(pairs,experiment_for(thresholds,name))
            except TrainingBlocked:
                reasons.append(name+"_nested_training_support_insufficient")
                break
    frozen=None
    if len(fitted)==2:
        # Write and hash the complete release candidate BEFORE any holdout prediction.
        frozen={"schema_version":"frozen-scientific-models/1.0.0","engine_version":ENGINE_VERSION,
                "thresholds_fingerprint":threshold_fingerprint(thresholds),"source_reconstruction_sha256":source_reconstruction_sha256,
                "source_entries_fingerprint":fingerprint(observed["source_entries"]),"models":fitted,
                "code_sha256":{name:file_hash(PROJECT/"science/scripts"/name) for name in ("calibration_models.py","run_scientific_experiments.py","scientific_thresholds.py")},
                "application_release":False,"harmonization_approved":False}
        write_json(output/"frozen-models.json",frozen)
        frozen_sha=file_hash(output/"frozen-models.json")
        write_json(output/"freeze-receipt.json",{"frozen_at_utc":datetime.now(timezone.utc).isoformat(),"model_sha256":frozen_sha,
                   "source_reconstruction_sha256":source_reconstruction_sha256,"thresholds_sha256":file_hash(CONFIG),"holdout_scoring_started":False})
        for name in NAMES:
            if file_hash(output/"frozen-models.json")!=frozen_sha or threshold_fingerprint(load_thresholds())!=frozen["thresholds_fingerprint"]:
                raise ValueError("Frozen model or thresholds changed before holdout scoring")
            model=json.loads((output/"frozen-models.json").read_text())["models"][name]
            predictions=predict_experiment(model,pairs,experiment_for(thresholds,name))
            write_json(output/(name+"-predictions.json"),predictions)
            evaluations[name]={view:evaluate_predictions(predictions[view],thresholds,name,view) for view in VIEWS}
    else:frozen_sha=None
    decision=select_plan(evaluations.get(NAMES[0],{}).get("Combined_Terra_Aqua"),evaluations.get(NAMES[1],{}).get("Combined_Terra_Aqua"),
                         pairs,provenance_verified=frozen is not None)
    result={"schema_version":"scientific-experiment-report/1.0.0","engine_version":ENGINE_VERSION,
            "source_reconstruction_sha256":source_reconstruction_sha256,"frozen_models_sha256":frozen_sha,
            "training_attempted":attempted,"completed_frozen_experiments":list(fitted),
            "evaluation_status":"completed" if evaluations else "not_run","empirical_metrics":evaluations or None,
            "blocking_reasons":reasons,"decision":decision["decision"],"harmonization_approved":decision["harmonization_approved"],
            "decision_reasons":decision["reasons"],"sample_readiness":observed["sample_readiness"],
            "thresholds_fingerprint":threshold_fingerprint(thresholds),"application_publication_performed":False,
            "notice":"Offline source-bound scientific evaluation only; synthetic app fixtures and production harmonization remain unchanged."}
    write_json(output/"summary.json",result)
    return result


def run(*,cache,output):
    output=output.resolve()
    if output.exists() or any(output.is_relative_to(PROJECT/name) for name in ("app","dist")):
        raise ValueError("Choose a new offline experiment directory")
    output.mkdir(parents=True)
    observed=reconstruct(cache=cache,output=output/"source-reconstruction")
    source=output/"source-reconstruction/observations.json";source_sha=file_hash(source)
    report=evaluate_reconstruction(observed,output,source_reconstruction_sha256=source_sha)
    if file_hash(source)!=source_sha:raise ValueError("Observed input changed during evaluation")
    return report


if __name__=="__main__":
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache",type=Path,required=True)
    parser.add_argument("--output",type=Path,required=True)
    args=parser.parse_args()
    try: report=run(**vars(args))
    except (ValueError,OSError,KeyError,ArithmeticError):parser.exit(1,"Error: source-bound scientific experiment failed integrity checks.\n")
    print(json.dumps({key:report[key] for key in ("evaluation_status","decision","harmonization_approved","blocking_reasons")}))
