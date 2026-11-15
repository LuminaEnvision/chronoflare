"""Read-only diagnostics for the frozen harmonization models.

The frozen models, thresholds and Plan B decision are never modified here. Held-out
test rows are used only to DESCRIBE the registered failure. Every comparison between
alternative calibration ideas is restricted to leave-one-year-out folds inside the
training window, so nothing in this report selects a fix on the spent test set.
"""
import argparse
from collections import defaultdict
from datetime import date, timedelta
import json
import math
from pathlib import Path
from statistics import median

import calibration_models as cm
from acquisition_plan import fingerprint
from indicator_methods import paired_iso_weeks
from normalize_detections import file_hash
from scientific_thresholds import load_thresholds, weekly_error_metrics
from validation_preflight import Experiment

NAMES = ("forward_validation_primary", "backward_transfer_validation")
CANDIDATES = ("native", "median_ratio", "eqm_clamp", "ratio_of_sums", "eqm_proportional_tail")
ALIGNMENTS = ("same_solar_date", "terra_night_assigned_to_next_solar_date")


def experiment_for(thresholds, name):
    section = thresholds["temporal_splits"][name]
    return Experiment(section["train_period"]["start_solar_date"], section["train_period"]["end_solar_date"],
                      section["test_period_out_of_sample"]["start_solar_date"], section["test_period_out_of_sample"]["end_solar_date"])


def stratum(row):
    return (row["predictor_platform"], row["day_night"], cm.season(row["solar_date"]))


def relative_bias(estimates, references):
    total = math.fsum(references)
    return (math.fsum(estimates) - total) / total


def mae(estimates, references):
    return math.fsum(abs(a - b) for a, b in zip(estimates, references)) / len(references)


def top_knot(suite, row):
    fitted = suite["models"][suite["routing"]["|".join(stratum(row))]]["fitted"]
    return fitted["nodes"][-1] if fitted["method"] == "empirical_quantile_mapping" else None


def above_top_knot(suite, row):
    knot = top_knot(suite, row)
    return knot is not None and row["predictor_value"] > knot[0]


def spearman(left, right):
    return weekly_error_metrics(left, right)["spearman"]


# --- 1. Bound implied by the frozen EQM ceiling (needs only the committed evidence) ---

def ceiling_bound(model, evaluation, experiment):
    """Largest daily value the frozen dry-season models can emit, and the bias it forces."""
    models = model["suite"]["models"]

    def ceiling(platform):
        tops = [models["|".join((platform, turn, "dry"))]["fitted"] for turn in ("D", "N")]
        return math.fsum(f["nodes"][-1][1] for f in tops) if all(f["method"] == "empirical_quantile_mapping" for f in tops) else None

    ceilings = {platform: ceiling(platform) for platform in cm.PLATFORMS}
    result = {"dry_season_daily_ceiling_mw": ceilings, "views": {}}
    end = (date.fromisoformat(experiment.test_end) + timedelta(days=1)).isoformat()
    for view, platforms in (("Terra_only", ["Terra"]), ("Aqua_only", ["Aqua"]), ("Combined_Terra_Aqua", list(cm.PLATFORMS))):
        limits = [ceilings[p] for p in platforms]
        if any(limit is None for limit in limits):
            continue
        limit = max(limits)  # a convex combination can never exceed the larger platform ceiling
        observed = evaluation[view]["paired_observed_values"]
        rows = [{"solar_date": day, "observed": value,
                 "estimated": min(value, limit) if cm.season(day) == "dry" else value} for day, value in observed.items()]
        weeks = [w for w in paired_iso_weeks(rows, experiment.test_start, end) if w["eligible_weekly_support"]]
        best = weekly_error_metrics([w["paired_daily_means"]["observed"] for w in weeks], [w["paired_daily_means"]["estimated"] for w in weeks])
        result["views"][view] = {"ceiling_mw": limit, "test_days": len(rows),
                                 "days_observed_above_ceiling": sum(r["estimated"] < r["observed"] for r in rows),
                                 "best_possible_weekly_pbias_given_ceiling": best["pbias"],
                                 "registered_weekly_pbias": evaluation[view]["weekly_metrics"]["pbias"]}
    return result


# --- 2. Description of the registered failure (test rows, descriptive only) ---

def describe_test(model, pairs, predictions, experiment):
    suite = model["suite"]
    test = [r for r in pairs if r["metric"] == "frp_sum_mw" and experiment.split(r["solar_date"]) == "test"]
    groups = defaultdict(list)
    for row in test:
        groups[stratum(row)].append(row)
    strata = []
    for key, rows in sorted(groups.items()):
        estimates = [cm.suite_predict(suite, r) for r in rows]
        native = [r["predictor_value"] for r in rows]
        reference = [r["reference_value"] for r in rows]
        strata.append({"stratum": "|".join(key), "pairs": len(rows), "years": sorted({r["solar_date"][:4] for r in rows}),
                       "inputs_above_top_knot": sum(above_top_knot(suite, r) for r in rows),
                       "calibrated_relative_bias": relative_bias(estimates, reference), "native_relative_bias": relative_bias(native, reference),
                       "calibrated_mae": mae(estimates, reference), "native_mae": mae(native, reference),
                       "max_native_input": max(native), "max_reference": max(reference)})
    by_pair = {(r["solar_date"], r["predictor_platform"], r["day_night"]): r for r in test}
    rows = predictions["Combined_Terra_Aqua"]
    end = (date.fromisoformat(experiment.test_end) + timedelta(days=1)).isoformat()
    weeks = [w for w in paired_iso_weeks(rows, experiment.test_start, end) if w["eligible_weekly_support"]]
    by_day = {r["solar_date"]: r for r in rows}
    observed_total = math.fsum(w["paired_daily_means"]["observed"] for w in weeks)
    parts = defaultdict(lambda: {"days": 0, "calibrated": 0., "native": 0., "observed": 0.})
    for week in weeks:
        for day in week["paired_days"]:
            row = by_day[day]
            used = [p for p in cm.PLATFORMS if p in row["regime"]]
            saturated = any(above_top_knot(suite, by_pair[(day, p, t)]) for p in used for t in ("D", "N"))
            for label in ("saturation|input_above_top_knot" if saturated else "saturation|inside_training_range",
                          "regime|" + row["regime"], "year|" + day[:4], "season|" + cm.season(day)):
                part = parts[label]
                part["days"] += 1
                for name, field in (("calibrated", "estimated"), ("native", "naive")):
                    part[name] += (row[field] - row["observed"]) / week["paired_day_count"]
                part["observed"] += row["observed"] / week["paired_day_count"]
    decomposition = [{"group": label, "days_in_eligible_weeks": part["days"], "share_of_observed_weekly_frp": part["observed"] / observed_total,
                      "calibrated_pbias_contribution": part["calibrated"] / observed_total, "native_pbias_contribution": part["native"] / observed_total,
                      "calibrated_bias_within_group": part["calibrated"] / part["observed"], "native_bias_within_group": part["native"] / part["observed"]}
                     for label, part in sorted(parts.items())]
    regimes = defaultdict(int)
    for row in rows:
        regimes[row["regime"]] += 1
    return {"turn_level_strata": strata, "weekly_pbias_decomposition": decomposition, "eligible_weeks": len(weeks),
            "all_test_days_by_regime": dict(regimes)}


# --- 3. Training-only comparison of calibration ideas (LOYO, never touches test rows) ---

def fit_idea(rows, idea):
    xs = [r["predictor_value"] for r in rows]
    ys = [r["reference_value"] for r in rows]
    if idea == "native":
        return lambda value: value
    if idea == "ratio_of_sums":
        scale = math.fsum(ys) / math.fsum(xs)
        return lambda value: value * scale
    if idea == "median_ratio":
        model = cm.fit_candidate(rows, "median_ratio")
        return lambda value: cm.predict_candidate(model, value)
    model = cm.fit_candidate(rows, "empirical_quantile_mapping")
    if idea == "eqm_clamp":
        return lambda value: cm.predict_candidate(model, value)
    if idea != "eqm_proportional_tail":
        raise ValueError("Unsupported diagnostic idea")
    low, high = model["nodes"][0], model["nodes"][-1]

    def predict(value):
        # Outside the knots, keep the endpoint ratio instead of freezing the endpoint value.
        if value < low[0]:
            return low[1] * value / low[0]
        if value > high[0]:
            return high[1] * value / high[0]
        return cm.predict_candidate(model, value)
    return predict


def shifted_terra_night(cells, pairs):
    """Hypothesis: Terra's ~22:30 night pass precedes the S-NPP ~01:30 pass of the NEXT solar date."""
    value = {(c["solar_date"], c["platform"], c["day_night"]): c["observed_frp_sum_mw"] for c in cells}
    kept = [r for r in pairs if not (r["predictor_platform"] == "Terra" and r["day_night"] == "N")]
    template = next(r for r in pairs if r["predictor_platform"] == "Terra" and r["day_night"] == "N")
    for (day, platform, turn), reference in sorted(value.items()):
        previous = (date.fromisoformat(day) - timedelta(days=1)).isoformat()
        predictor = value.get((previous, "Terra", "N"))
        if platform == "S-NPP" and turn == "N" and reference and predictor:
            kept.append({**template, "solar_date": day, "predictor_value": predictor, "reference_value": reference})
    return kept


def training_comparison(pairs, experiment, weights):
    training = [r for r in pairs if r["metric"] == "frp_sum_mw" and experiment.split(r["solar_date"]) == "train"]
    years = sorted({r["solar_date"][:4] for r in training})
    groups = defaultdict(list)
    for row in training:
        groups[stratum(row)].append(row)
    out_of_fold = {idea: {} for idea in CANDIDATES}
    saturation = defaultdict(lambda: {"pairs": 0, "above_fold_top_knot": 0})
    for key, rows in groups.items():
        for year in years:
            inner = [r for r in rows if r["solar_date"][:4] != year]
            held = [r for r in rows if r["solar_date"][:4] == year]
            if not held or not inner:
                continue
            top = cm.fit_candidate(inner, "empirical_quantile_mapping")["nodes"][-1][0]
            saturation[key]["pairs"] += len(held)
            saturation[key]["above_fold_top_knot"] += sum(r["predictor_value"] > top for r in held)
            for idea in CANDIDATES:
                predict = fit_idea(inner, idea)
                for row in held:
                    out_of_fold[idea][(row["solar_date"], row["predictor_platform"], row["day_night"])] = predict(row["predictor_value"])
    strata = []
    for key, rows in sorted(groups.items()):
        scored = [r for r in rows if (r["solar_date"], r["predictor_platform"], r["day_night"]) in out_of_fold["native"]]
        reference = [r["reference_value"] for r in scored]
        native = [r["predictor_value"] for r in scored]
        per_year = defaultdict(int)
        for row in rows:
            per_year[row["solar_date"][:4]] += 1
        entry = {"stratum": "|".join(key), "pairs": len(rows), "dates_per_year": dict(sorted(per_year.items())),
                 "ratio_of_sums": math.fsum(r["reference_value"] for r in rows) / math.fsum(r["predictor_value"] for r in rows),
                 "median_of_ratios": median(r["reference_value"] / r["predictor_value"] for r in rows),
                 "share_of_reference_frp_in_top_1_percent_of_pairs": math.fsum(sorted(r["reference_value"] for r in rows)[-max(1, len(rows) // 100):]) / math.fsum(r["reference_value"] for r in rows),
                 "oof_inputs_above_fold_top_knot": saturation[key]["above_fold_top_knot"], "oof_pairs": saturation[key]["pairs"],
                 "rank_correlation": spearman(native, reference), "ideas": {}}
        for idea in CANDIDATES:
            estimates = [out_of_fold[idea][(r["solar_date"], r["predictor_platform"], r["day_night"])] for r in scored]
            entry["ideas"][idea] = {"oof_mae": mae(estimates, reference), "oof_relative_bias": relative_bias(estimates, reference)}
        strata.append(entry)
    end = (date.fromisoformat(experiment.train_end) + timedelta(days=1)).isoformat()
    combined = {}
    regimes = defaultdict(int)
    for idea in CANDIDATES:
        daily = cm.daily_values(training, lambda row: out_of_fold[idea].get((row["solar_date"], row["predictor_platform"], row["day_night"])))
        rows = []
        for row in daily:
            value = cm.view_value(row, "Combined_Terra_Aqua", weights)
            if value:
                rows.append({"solar_date": row["solar_date"], "observed": row["observed"], "estimated": value["estimated"]})
                if idea == "native":
                    regimes[value["regime"]] += 1
        weeks = [w for w in paired_iso_weeks(rows, experiment.train_start, end) if w["eligible_weekly_support"]]
        weekly = weekly_error_metrics([w["paired_daily_means"]["observed"] for w in weeks], [w["paired_daily_means"]["estimated"] for w in weeks])
        combined[idea] = {"days": len(rows), "weekly": weekly,
                          "daily_mae": mae([r["estimated"] for r in rows], [r["observed"] for r in rows]),
                          "daily_relative_bias": relative_bias([r["estimated"] for r in rows], [r["observed"] for r in rows])}
    return {"training_years": years, "strata": strata, "combined_oof": combined, "combined_days_by_regime": dict(regimes),
            "note": "Weights are the frozen convex weights; ideas are fitted per stratum without the 30-date floor, for diagnosis only."}


# --- 4. Cohort and turn-alignment checks on observed cells ---

def cohort_selection(cells, start, end):
    value = {(c["solar_date"], c["platform"], c["day_night"]): c["observed_frp_sum_mw"] for c in cells if start <= c["solar_date"] <= end}
    groups = defaultdict(lambda: {"days": 0, "snpp_frp": 0.})
    for day in sorted({key[0] for key in value}):
        reference = [value.get((day, "S-NPP", turn)) for turn in ("D", "N")]
        complete = [all(value.get((day, p, turn)) for turn in ("D", "N")) for p in cm.PLATFORMS]
        label = ("snpp_day_and_night" if all(reference) else "snpp_one_turn" if any(reference) else "snpp_none") + "|modis_" + \
                ("both_complete" if all(complete) else "one_complete" if any(complete) else "none_complete")
        groups[label]["days"] += 1
        groups[label]["snpp_frp"] += math.fsum(v for v in reference if v)
    total = math.fsum(g["snpp_frp"] for g in groups.values())
    return [{"cohort": label, "days": g["days"], "share_of_snpp_frp": g["snpp_frp"] / total if total else None} for label, g in sorted(groups.items())]


def turn_alignment(cells, start, end):
    """Rank agreement of each MODIS turn with the S-NPP turn of the previous, same and next solar date."""
    value = {(c["solar_date"], c["platform"], c["day_night"]): c["observed_frp_sum_mw"] for c in cells}
    result = []
    for platform in cm.PLATFORMS:
        for turn in ("D", "N"):
            rows = []
            for (day, source, slot), predictor in value.items():
                if source != platform or slot != turn or not predictor or not start <= day <= end:
                    continue
                neighbours = [value.get(((date.fromisoformat(day) + timedelta(days=shift)).isoformat(), "S-NPP", turn)) for shift in (-1, 0, 1)]
                if all(neighbours):
                    rows.append((predictor, *neighbours))
            result.append({"platform": platform, "day_night": turn, "common_dates": len(rows),
                           **{name: spearman([r[0] for r in rows], [r[index] for r in rows])
                              for index, name in ((1, "spearman_previous_solar_date"), (2, "spearman_same_solar_date"), (3, "spearman_next_solar_date"))}})
    return result


def run(*, evidence, output):
    evidence = evidence.resolve()
    thresholds = load_thresholds()
    frozen = json.loads((evidence / "frozen-models.json").read_text())
    summary = json.loads((evidence / "summary.json").read_text())
    observed = json.loads((evidence / "source-reconstruction/observations.json").read_text())
    pairs, cells = observed["pairs"], observed["cells"]
    report = {"schema_version": "harmonization-diagnostics/1.0.0", "frozen_models_sha256": file_hash(evidence / "frozen-models.json"),
              "scope": "Diagnostic only. Frozen models, thresholds and the Plan B decision are unchanged; test rows describe the failure and select nothing.",
              "experiments": {}}
    for name in NAMES:
        experiment = experiment_for(thresholds, name)
        model = frozen["models"][name]
        stored = json.loads((evidence / (name + "-predictions.json")).read_text())
        shifted = shifted_terra_night(cells, pairs)
        report["experiments"][name] = {
            "reproducibility": {"stored_predictions_reproduced": cm.predict_experiment(model, pairs, experiment) == stored,
                                "refit_matches_frozen_model": fingerprint(cm.fit_experiment(pairs, experiment)) == fingerprint(model)},
            "eqm_ceiling": ceiling_bound(model, summary["empirical_metrics"][name], experiment),
            "registered_test_failure_description": describe_test(model, pairs, stored, experiment),
            "training_only": {alignment: training_comparison(pairs if alignment == ALIGNMENTS[0] else shifted, experiment, model["weight_fit"]["weights"])
                              for alignment in ALIGNMENTS},
            "training_cohort_selection": cohort_selection(cells, experiment.train_start, experiment.train_end),
            "training_turn_alignment": turn_alignment(cells, experiment.train_start, experiment.train_end)}
    if output is not None:
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(report, indent=2, allow_nan=False) + "\n")
    return report


def percent(value):
    return "n/a" if value is None else f"{100 * value:+.1f}%"


def print_summary(report):
    for name, section in report["experiments"].items():
        print(f"\n== {name}")
        print("reproducibility:", section["reproducibility"])
        for view, row in section["eqm_ceiling"]["views"].items():
            print(f"ceiling {view}: {row['ceiling_mw']:.0f} MW; {row['days_observed_above_ceiling']}/{row['test_days']} test days above it; "
                  f"best possible weekly PBias {percent(row['best_possible_weekly_pbias_given_ceiling'])} vs registered {percent(row['registered_weekly_pbias'])}")
        print("registered weekly PBias decomposition (combined view):")
        for row in section["registered_test_failure_description"]["weekly_pbias_decomposition"]:
            print(f"  {row['group']:<40} days={row['days_in_eligible_weeks']:<4} frp_share={percent(row['share_of_observed_weekly_frp'])} "
                  f"calibrated={percent(row['calibrated_pbias_contribution'])} native={percent(row['native_pbias_contribution'])}")
        for alignment, training in section["training_only"].items():
            print(f"training-only LOYO, {alignment}:")
            for idea, row in training["combined_oof"].items():
                weekly = row["weekly"]
                print(f"  {idea:<24} days={row['days']:<4} weeks={weekly['weeks']:<3} weekly_pbias={percent(weekly['pbias'])} "
                      f"weekly_mae={weekly['mae']:.0f} spearman={weekly['spearman']:.3f} daily_mae={row['daily_mae']:.0f}")
        print("training turn alignment (Spearman vs S-NPP previous/same/next solar date):")
        for row in section["training_turn_alignment"]:
            print(f"  {row['platform']} {row['day_night']}: n={row['common_dates']} {row['spearman_previous_solar_date']:.3f} / "
                  f"{row['spearman_same_solar_date']:.3f} / {row['spearman_next_solar_date']:.3f}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--evidence", type=Path, required=True, help="Extracted scientific-experiment-evidence artifact directory")
    parser.add_argument("--output", type=Path, help="Optional JSON report path (keep it under science/outputs/)")
    args = parser.parse_args()
    print_summary(run(**vars(args)))
