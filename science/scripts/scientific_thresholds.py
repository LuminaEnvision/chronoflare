"""Registered delivery-4 metrics and conservative decision gate; never fit a model."""
import argparse
import hashlib
from datetime import datetime
import json
import math
from pathlib import Path
from statistics import median
import sys

from indicator_methods import paired_iso_weeks
from normalize_detections import file_hash
from validation_preflight import Experiment

CONFIG = Path(__file__).resolve().parents[1] / "configs/thresholds.json"
VIEWS = {"Combined_Terra_Aqua": "combined_modis_to_viirs", "Aqua_only": "aqua_only", "Terra_only": "terra_only"}


def load_thresholds(path=CONFIG):
    data = json.loads(path.read_text())
    receipt = json.loads(path.with_name("thresholds.receipt.json").read_text())
    if file_hash(path) != receipt["operational_thresholds_sha256"]:
        raise ValueError("Registered thresholds differ from their frozen receipt")
    if data["schema_version"] != "1.0.0" or data["thresholds_version"] != "v1.0-pre-registered":
        raise ValueError("Unsupported threshold contract")
    local = datetime.fromisoformat(data["registered_at_local"])
    utc = datetime.fromisoformat(data["registered_at_utc"].replace("Z", "+00:00"))
    if local.utcoffset() is None or utc.utcoffset() is None or utc.utcoffset().total_seconds() != 0 or local != utc:
        raise ValueError("Registered local/UTC timestamps are inconsistent")
    if data["weekly_aggregation_rules"]["weekly_metric_aggregation"] != "mean_of_valid_paired_days" or data["weekly_aggregation_rules"]["min_paired_days_per_week"] != 5:
        raise ValueError("Weekly semantics require the registered implementation")
    for name in ("forward_validation_primary", "backward_transfer_validation"):
        config = data["temporal_splits"][name]
        Experiment(config["train_period"]["start_solar_date"], config["train_period"]["end_solar_date"], config["test_period_out_of_sample"]["start_solar_date"], config["test_period_out_of_sample"]["end_solar_date"])
    for section in data["minimum_sample_requirements"].values():
        for key, value in section.items():
            if key.startswith("min_") or key.endswith(("_weeks", "_days")):
                if isinstance(value, bool) or not isinstance(value, int) or value <= 0:
                    raise ValueError("Sample requirements must be positive integers")
    if receipt["declared_registered_at_local"] != data["registered_at_local"] or receipt["declared_registered_at_utc"] != data["registered_at_utc"]:
        raise ValueError("Receipt registration metadata differs")
    if data["target_definition"]["solar_day_offset_seconds"] != -13596 or data["target_definition"]["require_both_day_and_night_shifts"] is not True:
        raise ValueError("Unsupported target-day semantics")
    forward, backward = data["acceptance_thresholds"]["forward_validation_primary"], data["acceptance_thresholds"]["backward_transfer_validation"]
    probabilities = [forward["spearman_weekly_min"][key] for key in VIEWS.values()] + [forward["interval_80_nominal"][key] for key in ("nominal_level", "empirical_coverage_min", "empirical_coverage_max")] + [backward["spearman_weekly_min"], backward["empirical_coverage_min"]]
    positive_limits = [forward["percent_bias_max_abs"][key] for key in VIEWS.values()] + [forward["relative_mae_max"]["combined_modis_to_viirs"], forward["interval_80_nominal"]["median_relative_width_max"], backward["percent_bias_max_abs"]]
    if any(isinstance(value, bool) or not isinstance(value, (int,float)) or not math.isfinite(value) or not 0 <= value <= 1 for value in probabilities):
        raise ValueError("Invalid registered probability/correlation limit")
    if any(isinstance(value, bool) or not isinstance(value, (int,float)) or not math.isfinite(value) or value < 0 for value in positive_limits):
        raise ValueError("Invalid registered nonnegative limit")
    if forward["interval_80_nominal"]["empirical_coverage_min"] > forward["interval_80_nominal"]["empirical_coverage_max"] or forward["relative_mae_max"]["require_improvement_over_naive_uncalibrated"] is not True:
        raise ValueError("Unsupported interval/improvement semantics")
    if data["decision_rule"]["on_pass"] != {"decision":"plan_a","harmonization_approved":True} or data["decision_rule"]["on_fail_or_not_run"] != {"decision":"plan_b","harmonization_approved":False}:
        raise ValueError("Unsupported decision mapping")
    return data


def threshold_fingerprint(thresholds):
    return hashlib.sha256(json.dumps(thresholds, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def average_ranks(values):
    order = sorted(range(len(values)), key=values.__getitem__)
    ranks = [0.] * len(values)
    first = 0
    while first < len(order):
        last = first + 1
        while last < len(order) and values[order[last]] == values[order[first]]:
            last += 1
        rank = (first + 1 + last) / 2
        for index in order[first:last]: ranks[index] = rank
        first = last
    return ranks


def weekly_error_metrics(observed, estimated):
    if len(observed) != len(estimated):
        raise ValueError("Metric cohorts must have equal lengths")
    if any(isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value < 0 for value in [*observed, *estimated]):
        raise ValueError("Metric inputs must be finite nonnegative values")
    count = len(observed)
    if not count:
        return {"status": "not_run", "weeks": 0, "spearman": None, "pbias": None, "mae": None, "relative_mae": None}
    left, right = average_ranks(observed), average_ranks(estimated)
    center = (count + 1) / 2
    dx, dy = [value - center for value in left], [value - center for value in right]
    denominator = math.sqrt(math.fsum(value * value for value in dx) * math.fsum(value * value for value in dy))
    rho = math.fsum(a * b for a, b in zip(dx, dy)) / denominator if denominator else None
    observed_sum = math.fsum(observed)
    mae = math.fsum(abs(b - a) for a, b in zip(observed, estimated)) / count
    return {"status": "insufficient_activity" if observed_sum == 0 else "constant_series" if rho is None else "computed",
            "weeks": count, "spearman": rho, "pbias": math.fsum(b - a for a, b in zip(observed, estimated)) / observed_sum if observed_sum else None,
            "mae": mae, "relative_mae": mae / (observed_sum / count) if observed_sum else None}


def evaluate_predictions(rows, thresholds, experiment_name, view):
    """Evaluate explicit frozen-model daily predictions, not native MODIS observations.

    Caller must validate calibration/OOF provenance. This function cannot attest
    scientific origin or release a model based on scalar inputs alone.
    """
    if view not in VIEWS or experiment_name not in ("forward_validation_primary", "backward_transfer_validation"):
        raise ValueError("Explicit supported experiment and view are required")
    config = thresholds["temporal_splits"][experiment_name]
    start = config["test_period_out_of_sample"]["start_solar_date"]
    from datetime import date, timedelta
    end = (date.fromisoformat(config["test_period_out_of_sample"]["end_solar_date"]) + timedelta(days=1)).isoformat()
    seen, paired, exclusions = set(), [], []
    for row in rows:
        day = row["solar_date"]
        if date.fromisoformat(day).isoformat() != day or not start <= day < end or day in seen:
            raise ValueError("Duplicate, noncanonical or out-of-test prediction date")
        seen.add(day)
        for key in ("observed", "estimated", "lower", "upper", "naive"):
            value = row.get(key)
            if value is not None and (isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value < 0):
                raise ValueError("Invalid daily prediction value")
        if row["observed"] is None or row["estimated"] is None:
            exclusions.append({"solar_date": day, "reason": "unpaired_daily_value"}); continue
        if row["observed"] <= 0 or row["estimated"] <= 0 or row.get("complete_turn_support") is not True:
            raise ValueError("Positive paired daily indicators require explicit complete D/N support")
        if row.get("lower") is not None and row.get("upper") is not None and row["lower"] > row["upper"]:
            raise ValueError("Reversed daily uncertainty interval")
        paired.append(row)
    weeks = paired_iso_weeks(paired, start, end)
    eligible = [week for week in weeks if week["eligible_weekly_support"]]
    weekly = weekly_error_metrics([week["paired_daily_means"]["observed"] for week in eligible], [week["paired_daily_means"]["estimated"] for week in eligible])
    by_day = {row["solar_date"]: row for row in paired}
    matched_days = [day for week in eligible for day in week["paired_days"]]
    baseline_complete = bool(matched_days) and all(by_day[day].get("naive") is not None for day in matched_days)
    baseline = None
    if baseline_complete:
        naive_weekly = [math.fsum(by_day[day]["naive"] for day in week["paired_days"]) / week["paired_day_count"] for week in eligible]
        baseline = weekly_error_metrics([week["paired_daily_means"]["observed"] for week in eligible], naive_weekly)
    interval_complete = bool(paired) and all(row.get("lower") is not None and row.get("upper") is not None for row in paired)
    picp = sum(row["lower"] <= row["observed"] <= row["upper"] for row in paired) / len(paired) if interval_complete else None
    width = median((row["upper"] - row["lower"]) / row["estimated"] for row in paired) if interval_complete else None
    limits = thresholds["acceptance_thresholds"][experiment_name]
    sample = thresholds["minimum_sample_requirements"]["aoi_level_validation"]
    forward = experiment_name == "forward_validation_primary"
    rho_min = limits["spearman_weekly_min"][VIEWS[view]] if forward else limits["spearman_weekly_min"]
    bias_max = limits["percent_bias_max_abs"][VIEWS[view]] if forward else limits["percent_bias_max_abs"]
    checks = {"global_week_support": len(eligible) >= sample["forward_test_min_valid_weeks" if forward else "backward_test_min_valid_weeks"],
              "global_day_support": len(paired) >= sample["forward_test_min_valid_days" if forward else "backward_test_min_valid_days"],
              "spearman": weekly["spearman"] is not None and weekly["spearman"] >= rho_min,
              "pbias": weekly["pbias"] is not None and abs(weekly["pbias"]) <= bias_max}
    if forward:
        interval = limits["interval_80_nominal"]
        checks["picp"] = picp is not None and interval["empirical_coverage_min"] <= picp <= interval["empirical_coverage_max"]
        checks["relative_interval_width"] = width is not None and width <= interval["median_relative_width_max"]
        if view == "Combined_Terra_Aqua":
            checks["relative_mae"] = weekly["relative_mae"] is not None and weekly["relative_mae"] <= limits["relative_mae_max"][VIEWS[view]]
            if limits["relative_mae_max"]["require_improvement_over_naive_uncalibrated"]:
                checks["improves_naive_same_cohort"] = baseline is not None and weekly["mae"] < baseline["mae"]
    else:
        checks["picp"] = picp is not None and picp >= limits["empirical_coverage_min"]
    daily_diagnostics = weekly_error_metrics([row["observed"] for row in paired], [row["estimated"] for row in paired])
    daily_diagnostics["days"] = daily_diagnostics.pop("weeks")
    return {"experiment": experiment_name, "view": view, "status": "not_run" if not paired else "checks_passed" if all(checks.values()) else "checks_not_passed",
            "weekly_statistic": "mean_of_valid_paired_days", "weekly_metrics": weekly, "daily_error_diagnostics": daily_diagnostics, "naive_weekly_metrics_same_cohort": baseline,
            "paired_daily_count": len(paired), "paired_dates": sorted(row["solar_date"] for row in paired),
            "paired_observed_values": {row["solar_date"]: row["observed"] for row in paired}, "eligible_week_count": len(eligible), "picp_daily": picp,
            "median_relative_interval_width": width, "picp_weekly": None, "picp_weekly_status": "not_defined_by_current_daily_interval_recipe", "intervals_complete": interval_complete,
            "checks": checks, "excluded_daily_rows": exclusions, "thresholds_version": thresholds["thresholds_version"], "thresholds_fingerprint": threshold_fingerprint(thresholds)}



def assess_strata(pairs, thresholds, experiment_name):
    config = thresholds["temporal_splits"][experiment_name]
    experiment = Experiment(config["train_period"]["start_solar_date"], config["train_period"]["end_solar_date"], config["test_period_out_of_sample"]["start_solar_date"], config["test_period_out_of_sample"]["end_solar_date"])
    from collections import defaultdict
    support = defaultdict(lambda: {"train": set(), "test": set()})
    seen = set()
    for row in pairs:
        if row["metric"] != "frp_sum_mw": continue
        platform, turn = row["predictor_platform"], row["day_night"]
        if platform not in ("Terra", "Aqua") or row["reference_platform"] != "S-NPP" or turn not in ("D", "N"):
            raise ValueError("Unsupported stratum source")
        day = row["solar_date"]
        split = experiment.split(day)
        key = (platform, turn, day)
        if key in seen: raise ValueError("Duplicate observed stratum pair")
        seen.add(key)
        for field in ("predictor_value", "reference_value"):
            if isinstance(row[field], bool) or not isinstance(row[field], (float, int)) or not math.isfinite(row[field]) or row[field] <= 0:
                raise ValueError("Stratum support requires positive observed pairs")
        if split == "outside": continue
        season = "dry" if 7 <= int(day[5:7]) <= 11 else "wet"
        support[(platform, turn, season)][split].add(day)
    floor = thresholds["minimum_sample_requirements"]["per_stratum"]
    def describe(platform, turn, season, dates):
        train, test = sorted(dates["train"]), sorted(dates["test"])
        train_years, test_years = len({day[:4] for day in train}), len({day[:4] for day in test})
        eligible = len(train) >= floor["min_train_paired_days"] and train_years >= floor["min_train_distinct_years"] and len(test) >= floor["min_test_paired_days"] and test_years >= floor["min_test_distinct_years"]
        return {"platform": platform, "day_night": turn, "season": season, "train_dates": train, "test_dates": test,
                "train_count": len(train), "test_count": len(test), "train_years": train_years, "test_years": test_years, "eligible": eligible}
    rows = []
    covered = set()
    for platform in ("Terra", "Aqua"):
        for turn in ("D", "N"):
            for season in ("dry", "wet"):
                row = describe(platform, turn, season, support[(platform, turn, season)])
                rows.append(row)
                if row["eligible"]: covered.add((platform, turn, season))
            if not all((platform, turn, season) in covered for season in ("dry", "wet")):
                combined = {split: support[(platform, turn, "dry")][split] | support[(platform, turn, "wet")][split] for split in ("train", "test")}
                row = describe(platform, turn, "all_seasons", combined); rows.append(row)
                if row["eligible"]: covered.update((platform, turn, season) for season in ("dry", "wet"))
    return {"experiment": experiment_name, "rows": rows, "all_required_strata_eligible": len(covered) == 8,
            "scope": "Observed positive same-turn dates; sample support alone does not approve a model"}


def select_plan(forward, backward, observed_pairs, *, provenance_verified=False):
    thresholds = load_thresholds()
    observed_pairs = tuple(observed_pairs)
    support = {name: assess_strata(observed_pairs, thresholds, name) for name in ("forward_validation_primary", "backward_transfer_validation")}
    reasons = []
    for name, result in support.items():
        if not result["all_required_strata_eligible"]: reasons.append(name + "_strata_insufficient")
    base = {"global_week_support", "global_day_support", "spearman", "pbias", "picp"}
    from collections import defaultdict
    complete = defaultdict(set)
    reference_values = {}
    for row in observed_pairs:
        if row["metric"] != "frp_sum_mw": continue
        complete[(row["predictor_platform"], row["solar_date"])].add(row["day_night"])
        key = (row["solar_date"], row["day_night"])
        if key in reference_values and reference_values[key] != row["reference_value"]:
            raise ValueError("Reference values differ across platform cohorts")
        reference_values[key] = row["reference_value"]
    candidate_dates = {day for (_, day), turns in complete.items() if turns == {"D", "N"}}
    for name, result in (("forward_validation_primary", forward), ("backward_transfer_validation", backward)):
        required = base | {"relative_interval_width", "relative_mae", "improves_naive_same_cohort"} if name == "forward_validation_primary" else base
        if result is None or result.get("status") == "not_run":
            reasons.append(name + "_not_run")
        elif (result.get("experiment") != name or result.get("view") != "Combined_Terra_Aqua" or result.get("status") != "checks_passed"
              or result.get("thresholds_fingerprint") != threshold_fingerprint(thresholds)
              or set(result.get("checks", {})) != required or not all(value is True for value in result["checks"].values())):
            reasons.append(name + "_required_checks_not_passed")
        if result is not None and result.get("status") != "not_run":
            window = thresholds["temporal_splits"][name]["test_period_out_of_sample"]
            expected_days = {day for day in candidate_dates if window["start_solar_date"] <= day <= window["end_solar_date"]}
            actual_days = result.get("paired_dates", [])
            target_values = result.get("paired_observed_values", {})
            if (len(actual_days) != len(set(actual_days)) or set(actual_days) != expected_days
                or any(day not in target_values or not math.isclose(target_values[day], math.fsum(reference_values[(day, turn)] for turn in ("D", "N")), rel_tol=1e-12, abs_tol=1e-9) for day in expected_days)):
                reasons.append(name + "_daily_cohort_or_reference_mismatch")
    if provenance_verified is not True: reasons.append("frozen_model_and_evaluation_provenance_not_verified")
    return {"decision": "plan_a" if not reasons else "plan_b", "harmonization_approved": not reasons,
            "reasons": reasons, "sample_support": support, "thresholds_fingerprint": threshold_fingerprint(thresholds),
            "scope": "Required combined forward/backward criteria and all registered stratum support; not a public deployment action"}


def write_current_readiness(*, observations, output):
    project = Path(__file__).resolve().parents[2]
    output = output.resolve()
    if output.exists() or any(output.is_relative_to(project / name) for name in ("app", "dist")):
        raise ValueError("Choose a new offline decision report directory")
    thresholds = load_thresholds()
    observed_hash = file_hash(observations)
    source = json.loads(observations.read_text())
    if source.get("schema_version") != "observed-indicator-preparation/1.1.0" or source.get("fit_performed") is not False:
        raise ValueError("Readiness requires the explicit observed-input preparation report")
    pairs = [pair for result in source["forward_pairing"].values() for pair in result["pairs"]]
    result = select_plan(None, None, pairs)
    summary = {"schema_version": "scientific-validation-readiness/1.0.0", "thresholds_sha256": file_hash(CONFIG),
               "observations_sha256": observed_hash, "thresholds_registered_at_utc": thresholds["registered_at_utc"],
               "evaluation_status": "not_run", "empirical_metrics": None, **result,
               "notice": "Plan B is required because support is insufficient and frozen-model evaluation has not run; this is not an empirical failure result."}
    if file_hash(observations) != observed_hash: raise ValueError("Observed preparation changed during readiness")
    output.mkdir(parents=True)
    (output / "validation").mkdir()
    try:
        (output / "validation/summary.json").write_text(json.dumps(summary, indent=2, allow_nan=False) + "\n")
        (output / "manifest.json").write_text(json.dumps({"schema_version": "scientific-validation-manifest/1.0.0", "decision": result["decision"],
            "harmonization_approved": result["harmonization_approved"], "evaluation_status": "not_run", "thresholds_sha256": summary["thresholds_sha256"]}, indent=2) + "\n")
    except OSError:
        import shutil
        shutil.rmtree(output)
        raise
    return summary


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--observations", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    try:
        report = write_current_readiness(**vars(args))
    except (OSError, ValueError, KeyError, TypeError):
        parser.exit(1, "Error: threshold registration or decision evidence failed validation.\n")
    print(f"Scientific readiness: {report['decision']}; evaluation not run; no harmonization approved.")


if __name__ == "__main__":
    main()
