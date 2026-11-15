"""Revised harmonization candidate (v2): training-only, never an approved model.

Differences from the frozen v1 engine, each motivated by training-only diagnostics
(docs/harmonization-diagnostics.md) and fixed before any v2 holdout scoring:

1. Pass alignment: Terra's night pass (about 22:30 local solar time) is paired with, and
   summed into, the FOLLOWING solar date, next to the S-NPP night pass about 3 hours later.
2. Candidates preserve scale beyond the training range: ratio of sums, EQM with
   proportional tails, and the median ratio. Endpoint-clamped EQM is excluded a priori
   because it cannot represent values above the training range.
3. One method family is selected for the whole suite on the registered objective:
   out-of-fold weekly MAE of the combined view after daily combination.
4. Days with any input above its stratum's training maximum are flagged as extrapolated
   and their intervals inflated by the existing `empirical_ratio_interval` rule.

The S-NPP target, seasons, sample floors, season fallback, convex inverse-MAE weights,
nested leave-one-year-out residual intervals and the native benchmark are unchanged.
"""
from collections import defaultdict
from datetime import date, timedelta
import math

import calibration_models as cm
from acquisition_plan import fingerprint
from indicator_methods import empirical_ratio_interval, paired_iso_weeks, positive
from scientific_thresholds import weekly_error_metrics

ENGINE_VERSION = "loyo-calibration/2.0.0-candidate"
# Order is the tie-break: simplest first.
METHODS = ("ratio_of_sums", "eqm_proportional_tail", "median_ratio")
SHIFTED = (("Terra", "N"),)


def predictor_date(target_day, platform, turn):
    """Solar date of the MODIS turn that estimates this target date's S-NPP turn."""
    if (platform, turn) in SHIFTED:
        return (date.fromisoformat(target_day) - timedelta(days=1)).isoformat()
    return target_day


def build_pairs(cells, region_id):
    """Pair observed positive turn sums; absent turns stay absent, never zero."""
    value = {}
    for cell in cells:
        key = (cell["solar_date"], cell["platform"], cell["day_night"])
        if key in value:
            raise ValueError("Duplicate observed turn")
        value[key] = cell["observed_frp_sum_mw"]
    pairs = []
    for (day, platform, turn), reference in sorted(value.items()):
        if platform != "S-NPP" or reference is None:
            continue
        for source in cm.PLATFORMS:
            origin = predictor_date(day, source, turn)
            predictor = value.get((origin, source, turn))
            if predictor is not None:
                pairs.append({"region_id": region_id, "solar_date": day, "predictor_solar_date": origin, "day_night": turn,
                              "metric": "frp_sum_mw", "predictor_platform": source, "reference_platform": "S-NPP",
                              "predictor_value": positive(predictor), "reference_value": positive(reference)})
    return pairs


def fit_method(rows, method):
    if not rows:
        raise cm.TrainingBlocked("No positive training pairs")
    xs = [positive(r["predictor_value"]) for r in rows]
    ys = [positive(r["reference_value"]) for r in rows]
    base = {"method": method, "training_max_predictor": max(xs), "training_pairs": len(rows)}
    if method == "ratio_of_sums":
        return {**base, "scale": math.fsum(ys) / math.fsum(xs)}
    if method == "median_ratio":
        return {**base, "scale": cm.fit_candidate(rows, "median_ratio")["alpha"]}
    if method == "eqm_proportional_tail":
        return {**base, "nodes": cm.fit_candidate(rows, "empirical_quantile_mapping")["nodes"],
                "outside_range": "proportional_to_endpoint_ratio"}
    raise ValueError("Unsupported v2 calibration method")


def predict_method(model, value):
    value = positive(value)
    if "scale" in model:
        return positive(value * model["scale"])
    low, high = model["nodes"][0], model["nodes"][-1]
    if value < low[0]:
        return positive(low[1] * value / low[0])
    if value > high[0]:
        return positive(high[1] * value / high[0])
    return cm.predict_candidate({"method": "empirical_quantile_mapping", "nodes": model["nodes"]}, value)


def fit_suite(rows, method):
    """Per platform/turn/season fits with the registered same-platform/turn season fallback."""
    models, routing = {}, {}
    for platform in cm.PLATFORMS:
        for turn in ("D", "N"):
            scoped = [r for r in rows if r["predictor_platform"] == platform and r["day_night"] == turn]
            for name in ("dry", "wet"):
                selected = [r for r in scoped if cm.season(r["solar_date"]) == name]
                scope = name if cm.training_floor(selected) else "all_seasons"
                key = "|".join((platform, turn, scope))
                if key not in models:
                    chosen = selected if scope == name else scoped
                    if not cm.training_floor(chosen):
                        raise cm.TrainingBlocked("Stratum training floor not met")
                    dates = sorted({r["solar_date"] for r in chosen})
                    models[key] = {"fitted": fit_method(chosen, method), "train_date_count": len(dates),
                                   "train_years": sorted({day[:4] for day in dates})}
                routing["|".join((platform, turn, name))] = key
    return {"method": method, "models": models, "routing": routing}


def stratum_model(suite, row):
    route = "|".join((row["predictor_platform"], row["day_night"], cm.season(row["solar_date"])))
    return suite["models"][suite["routing"][route]]["fitted"]


def suite_predict(suite, row):
    return predict_method(stratum_model(suite, row), row["predictor_value"])


def extrapolated_days(suite, rows):
    return {r["solar_date"] for r in rows if r["predictor_value"] > stratum_model(suite, r)["training_max_predictor"]}


def years_of(rows):
    return sorted({r["solar_date"][:4] for r in rows})


def loyo_daily(rows, method):
    """Out-of-fold daily platform estimates: each year is predicted by a suite fitted without it."""
    result = []
    for year in years_of(rows):
        suite = fit_suite([r for r in rows if r["solar_date"][:4] != year], method)
        result.extend(cm.daily_values([r for r in rows if r["solar_date"][:4] == year], lambda row: suite_predict(suite, row)))
    return sorted(result, key=lambda r: r["solar_date"])


def combined_weekly(daily, weights, start, end):
    rows = []
    for row in daily:
        value = cm.view_value(row, "Combined_Terra_Aqua", weights)
        if value:
            rows.append({"solar_date": row["solar_date"], "observed": row["observed"], "estimated": value["estimated"]})
    end_exclusive = (date.fromisoformat(end) + timedelta(days=1)).isoformat()
    weeks = [w for w in paired_iso_weeks(rows, start, end_exclusive) if w["eligible_weekly_support"]]
    return weekly_error_metrics([w["paired_daily_means"]["observed"] for w in weeks], [w["paired_daily_means"]["estimated"] for w in weeks])


def select_method(rows, start, end):
    """Choose one family by out-of-fold weekly MAE of the combined view; ties keep METHODS order."""
    table = {}
    for method in METHODS:
        daily = loyo_daily(rows, method)
        weights = cm.learn_weights(daily)
        weekly = combined_weekly(daily, weights["weights"], start, end)
        if weekly["mae"] is None:
            raise cm.TrainingBlocked("No eligible out-of-fold training week")
        table[method] = {"weekly": weekly, "weight_fit": weights}
    chosen = min(METHODS, key=lambda method: table[method]["weekly"]["mae"])
    return {"method": chosen, "weight_fit": table[chosen]["weight_fit"],
            "candidate_oof_weekly": {method: table[method]["weekly"] for method in METHODS}}


def fit_experiment(pairs, experiment):
    training = sorted([r for r in pairs if r["metric"] == "frp_sum_mw" and experiment.split(r["solar_date"]) == "train"],
                      key=lambda r: (r["solar_date"], r["predictor_platform"], r["day_night"]))
    if not training:
        raise cm.TrainingBlocked("No training input")
    if len({r.get("region_id") for r in training}) != 1:
        raise ValueError("Mixed training regions")
    seen = set()
    for row in training:
        key = (row["solar_date"], row["predictor_platform"], row["day_night"])
        if key in seen or row["predictor_platform"] not in cm.PLATFORMS or row["day_night"] not in ("D", "N") or row["reference_platform"] != "S-NPP":
            raise ValueError("Unsupported or duplicated training pair")
        seen.add(key)
    window = (experiment.train_start, experiment.train_end)
    # Nested LOYO: each outer year's residuals exclude it from selection, fitting and weights.
    residuals, outer_folds = defaultdict(dict), []
    for year in years_of(training):
        fold_train = [r for r in training if r["solar_date"][:4] != year]
        fold_test = [r for r in training if r["solar_date"][:4] == year]
        selection = select_method(fold_train, *window)
        suite = fit_suite(fold_train, selection["method"])
        for row in cm.daily_values(fold_test, lambda row: suite_predict(suite, row)):
            for view in cm.VIEWS:
                predicted = cm.view_value(row, view, selection["weight_fit"]["weights"])
                if predicted:
                    residuals[view + "|" + predicted["regime"] + "|" + cm.season(row["solar_date"])][row["solar_date"]] = row["observed"] / predicted["estimated"]
        outer_folds.append({"excluded_year": year, "selected_method": selection["method"], "fold_weights": selection["weight_fit"]["weights"],
                            "fold_model_sha256": fingerprint(suite)})
    selection = select_method(training, *window)
    intervals = {}
    for key, values in sorted(residuals.items()):
        if len(values) >= 2:
            intervals[key] = {"q10": cm.quantile(list(values.values()), .1), "q90": cm.quantile(list(values.values()), .9), "count": len(values)}
    return {"schema_version": ENGINE_VERSION, "train_window": list(window), "test_window": [experiment.test_start, experiment.test_end],
            "training_pairs_sha256": fingerprint(training), "training_years": years_of(training),
            "training_date_count": len({r["solar_date"] for r in training}),
            "suite": fit_suite(training, selection["method"]), "weight_fit": selection["weight_fit"],
            "candidate_oof_weekly": selection["candidate_oof_weekly"], "intervals": intervals, "nested_outer_folds": outer_folds,
            "policy": {"pass_alignment": "Terra night turn assigned to the following solar date; all other turns keep their solar date",
                       "candidates": list(METHODS), "excluded_a_priori": "endpoint-clamped EQM",
                       "selection": "one family per suite by out-of-fold weekly MAE of the combined view; ties keep candidate order",
                       "weights": "inverse daily out-of-fold MAE on the common complete cohort",
                       "extrapolation": "input above the stratum training maximum flags the day and inflates its interval",
                       "naive_baseline": "uncalibrated native daily values with identical convex weights, alignment and cohort"},
            "harmonization_approved": False}


def predict_experiment(model, pairs, experiment):
    if model["train_window"] != [experiment.train_start, experiment.train_end] or model["test_window"] != [experiment.test_start, experiment.test_end]:
        raise ValueError("Frozen model experiment mismatch")
    testing = [r for r in pairs if r["metric"] == "frp_sum_mw" and experiment.split(r["solar_date"]) == "test"]
    suite, weights = model["suite"], model["weight_fit"]["weights"]
    flagged = {platform: extrapolated_days(suite, [r for r in testing if r["predictor_platform"] == platform]) for platform in cm.PLATFORMS}
    result = {view: [] for view in cm.VIEWS}
    for row in cm.daily_values(testing, lambda row: suite_predict(suite, row)):
        for view in cm.VIEWS:
            predicted = cm.view_value(row, view, weights)
            if not predicted:
                continue
            day = row["solar_date"]
            extrapolated = any(day in flagged[platform] for platform in cm.PLATFORMS if platform in predicted["regime"])
            interval = model["intervals"].get(view + "|" + predicted["regime"] + "|" + cm.season(day))
            bounds = empirical_ratio_interval(predicted["estimated"], interval["q10"], interval["q90"], is_extrapolated=extrapolated) if interval else None
            result[view].append({"solar_date": day, "observed": row["observed"], "estimated": predicted["estimated"], "naive": predicted["naive"],
                                 "lower": bounds["uncertainty_lower"] if bounds else None, "upper": bounds["uncertainty_upper"] if bounds else None,
                                 "regime": predicted["regime"], "is_extrapolated": extrapolated, "complete_turn_support": True})
    return result
