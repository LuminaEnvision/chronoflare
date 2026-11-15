"""Export the approved harmonized daily series from the frozen v2 forward model.

Runs only under the scientific owner's recorded Plan A decision, with the frozen model
and evidence hashes that decision names. It applies the model unchanged: nothing is
refitted, and absent observations stay absent. Per the registered publication scope,
a solar date is exported only when both Terra and Aqua are complete.
"""
import argparse
from datetime import date, timedelta
import json
import math
from pathlib import Path

import calibration_models as cm
import calibration_models_v2 as v2
import independent_holdout
from acquisition_plan import fingerprint
from indicator_methods import empirical_ratio_interval
from normalize_detections import file_hash

PROJECT = Path(__file__).resolve().parents[2]
DECISION = PROJECT / "science/configs/harmonization_decision.json"
EVIDENCE = PROJECT / "docs/multiyear-evidence/v2-candidate"
EXPERIMENT = "forward_validation_primary"
REGIME = "Terra+Aqua_weighted"
SCHEMA = "harmonized-daily-series/1.0.0"
APP_OUTPUT = PROJECT / "app/public/data/observations/v1"
APP_PATH = "/data/observations/v1/"
TURNS = (("day", "D"), ("night", "N"))


def load_decision(path=DECISION):
    data = json.loads(Path(path).read_text())
    if (data.get("status") != "registered" or data.get("decision") != "plan_a" or data.get("harmonization_approved") is not True
            or not isinstance(data.get("registered_by"), str) or not data["registered_by"].strip()
            or data.get("approved_model", {}).get("experiment") != EXPERIMENT or data["approved_model"].get("view") != "Combined_Terra_Aqua"
            or data["approved_model"].get("frozen_models_sha256") != file_hash(EVIDENCE / "frozen-models-v2.json")
            or data.get("evidence", {}).get("independent_summary_sha256") != file_hash(EVIDENCE / "independent-summary-v2.json")
            or data["evidence"].get("registration_sha256") != file_hash(independent_holdout.REGISTRATION)):
        raise ValueError("No registered Plan A decision matches the frozen model and independent evidence")
    summary = json.loads((EVIDENCE / "independent-summary-v2.json").read_text())
    if summary.get("all_registered_forward_combined_checks_met") is not True or summary.get("independent_validation") is not True:
        raise ValueError("The independent evidence does not meet the registered checks")
    return data, summary


def sample_role(day, model, holdout_dates):
    """How this date relates to the evidence; estimates on training dates are in-sample."""
    if model["train_window"][0] <= day <= model["train_window"][1]:
        return "training_window_in_sample"
    return "independent_holdout" if day in holdout_dates else "post_hoc_examined_holdout"


def daily_series(model, cells, holdout_dates):
    value = {}
    for cell in cells:
        key = (cell["solar_date"], cell["platform"], cell["day_night"])
        if key in value:
            raise ValueError("Duplicate observed turn")
        value[key] = cell["observed_frp_sum_mw"]
    suite, weights = model["suite"], model["weight_fit"]["weights"]
    rows = []
    for day in sorted({key[0] for key in value}):
        inputs = {(platform, turn): value.get((v2.predictor_date(day, platform, turn), platform, turn))
                  for platform in cm.PLATFORMS for turn in ("D", "N")}
        if any(item is None for item in inputs.values()):
            continue  # registered scope: both platforms complete; an absent turn is never zero
        estimates, native, extrapolated = {}, {}, False
        for platform in cm.PLATFORMS:
            parts = []
            for turn in ("D", "N"):
                row = {"solar_date": day, "predictor_platform": platform, "day_night": turn, "predictor_value": inputs[(platform, turn)]}
                parts.append(v2.suite_predict(suite, row))
                extrapolated = extrapolated or row["predictor_value"] > v2.stratum_model(suite, row)["training_max_predictor"]
            estimates[platform] = math.fsum(parts)
            native[platform] = math.fsum(inputs[(platform, turn)] for turn in ("D", "N"))
        estimate = math.fsum(weights[platform] * estimates[platform] for platform in cm.PLATFORMS)
        season = cm.season(day)
        interval = model["intervals"].get("Combined_Terra_Aqua|" + REGIME + "|" + season)
        bounds = empirical_ratio_interval(estimate, interval["q10"], interval["q90"], is_extrapolated=extrapolated) if interval else None
        reference = [value.get((day, "S-NPP", turn)) for turn in ("D", "N")]
        rows.append({"solar_date": day, "season": season, "harmonized_frp_mw": estimate,
                     "interval_80_lower_mw": bounds["uncertainty_lower"] if bounds else None,
                     "interval_80_upper_mw": bounds["uncertainty_upper"] if bounds else None,
                     "is_extrapolated": extrapolated, "regime": REGIME,
                     "inputs": {"terra_day_mw": inputs[("Terra", "D")], "terra_night_mw": inputs[("Terra", "N")],
                                "aqua_day_mw": inputs[("Aqua", "D")], "aqua_night_mw": inputs[("Aqua", "N")],
                                "terra_night_source_date": v2.predictor_date(day, "Terra", "N")},
                     "terra_calibrated_frp_mw": estimates["Terra"], "aqua_calibrated_frp_mw": estimates["Aqua"],
                     "native_weighted_modis_frp_mw": math.fsum(weights[platform] * native[platform] for platform in cm.PLATFORMS),
                     "snpp_observed_frp_mw": math.fsum(reference) if all(item is not None for item in reference) else None,
                     "sample_role": sample_role(day, model, holdout_dates)})
    return rows


def weekly_series(rows):
    """Registered weekly statistic: mean of valid days, only for ISO weeks with at least five."""
    groups = {}
    for row in rows:
        day = date.fromisoformat(row["solar_date"])
        groups.setdefault(day - timedelta(days=day.weekday()), []).append(row)
    weeks = []
    for monday, members in sorted(groups.items()):
        if len(members) < 5:
            continue
        observed = [row["snpp_observed_frp_mw"] for row in members]
        weeks.append({"iso_week_start": monday.isoformat(), "iso_year": monday.isocalendar().year, "iso_week": monday.isocalendar().week,
                      "valid_days": len(members), "harmonized_frp_mw_daily_mean": math.fsum(row["harmonized_frp_mw"] for row in members) / len(members),
                      "native_weighted_modis_frp_mw_daily_mean": math.fsum(row["native_weighted_modis_frp_mw"] for row in members) / len(members),
                      "snpp_observed_frp_mw_daily_mean": math.fsum(observed) / len(members) if all(item is not None for item in observed) else None,
                      "extrapolated_days": sum(row["is_extrapolated"] for row in members)})
    return weeks


def load_inputs(observations, holdout_observations, decision_path=DECISION):
    """Verify the decision and that both observation files are the ones the evidence used."""
    decision, summary = load_decision(decision_path)
    frozen = json.loads((EVIDENCE / "frozen-models-v2.json").read_text())
    if frozen["observations_sha256"] != file_hash(observations) or summary["holdout_observations_sha256"] != file_hash(holdout_observations):
        raise ValueError("Observations differ from the ones the frozen model and the independent test used")
    examined, holdout = json.loads(observations.read_text()), json.loads(holdout_observations.read_text())
    if not (examined["region_id"] == holdout["region_id"] == decision["region_id"]):
        raise ValueError("Mixed regions")
    return decision, summary, frozen, examined["cells"] + holdout["cells"]


def native_turn(cell):
    """A selected positive turn aggregate, or null when no positive selected row exists."""
    if cell is None or cell["observed_frp_sum_mw"] is None:
        if cell is not None and cell["observed_detection_count"] is not None:
            raise ValueError("Detection count without an FRP sum")
        return None
    value, count = cell["observed_frp_sum_mw"], cell["observed_detection_count"]
    if (isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value <= 0
            or type(count) is not int or count <= 0):
        raise ValueError("A native turn needs strictly positive FRP and a positive integer count")
    return {"frp_mw": float(value), "count": count}


def export_app(*, observations, holdout_observations, output=APP_OUTPUT, decision_path=DECISION):
    """Write the browser contract: native turn aggregates for every acquired date plus approved estimates."""
    from indicator_methods import DEDUP_VERSION
    from indicator_quality import RULE_VERSION
    decision, _, frozen, cells = load_inputs(observations, holdout_observations, decision_path)
    output = Path(output).resolve()
    if output.is_symlink() or (output.exists() and any(not (item.is_file() and not item.is_symlink() and (item.name == "manifest.json" or
                               (item.suffix == ".json" and item.stem.isdigit() and len(item.stem) == 4))) for item in output.iterdir())):
        raise ValueError("Unsafe export directory")
    model = frozen["models"][EXPERIMENT]
    estimates = {row["solar_date"]: row for row in daily_series(model, cells, independent_holdout.holdout_dates(independent_holdout.load_plan()))}
    by_key = {}
    for cell in cells:
        key = (cell["solar_date"], cell["platform"], cell["day_night"])
        if key in by_key:
            raise ValueError("Duplicate observed turn")
        by_key[key] = cell
    years = {}
    for day in sorted({key[0] for key in by_key}):
        row = {"date": day}
        for name, platform in (("terra", "Terra"), ("aqua", "Aqua"), ("snpp", "S-NPP")):
            row[name] = {label: native_turn(by_key.get((day, platform, turn))) for label, turn in TURNS}
        estimate = estimates.get(day)
        row["harmonized"] = None
        if estimate is not None:
            value, lower, upper = estimate["harmonized_frp_mw"], estimate["interval_80_lower_mw"], estimate["interval_80_upper_mw"]
            if lower is None or upper is None or not (math.isfinite(value) and value > 0 and 0 <= lower <= upper and math.isfinite(upper)):
                raise ValueError("An approved estimate lacks a valid interval")
            inputs = estimate["inputs"]
            # Audit completeness against the native rows instead of trusting flags.
            previous = by_key.get((inputs["terra_night_source_date"], "Terra", "N"))
            if (inputs["terra_day_mw"] != row["terra"]["day"]["frp_mw"] or inputs["aqua_day_mw"] != row["aqua"]["day"]["frp_mw"]
                    or inputs["aqua_night_mw"] != row["aqua"]["night"]["frp_mw"] or previous is None or inputs["terra_night_mw"] != previous["observed_frp_sum_mw"]
                    or date.fromisoformat(inputs["terra_night_source_date"]) != date.fromisoformat(day) - timedelta(days=1)):
                raise ValueError("Harmonized inputs do not reconcile with native observations")
            row["harmonized"] = {"value_mw": value, "lower_mw": lower, "upper_mw": upper, "is_extrapolated": estimate["is_extrapolated"],
                                 "regime": estimate["regime"], "inputs": inputs}
        years.setdefault(int(day[:4]), []).append(row)
    output.mkdir(parents=True, exist_ok=True)
    for stale in output.iterdir():
        stale.unlink()
    listing = []
    for year, days in sorted(years.items()):
        path = output / f"{year}.json"
        path.write_text(json.dumps({"schema_version": "chronoflare-observation-year/1.0.0", "year": year, "days": days}, allow_nan=False, separators=(",", ":")) + "\n")
        listing.append({"year": year, "path": f"{APP_PATH}{year}.json", "sha256": file_hash(path), "bytes": path.stat().st_size, "day_count": len(days)})
    manifest = {"schema_version": "chronoflare-observations/1.0.0", "region_id": decision["region_id"], "region_name": "Brazilian Pantanal",
                "solar_offset_seconds": -13596, "coverage_status": "unknown", "quality_rule_version": RULE_VERSION, "dedup_rule_version": DEDUP_VERSION,
                "source_observation_sha256": [file_hash(observations), file_hash(holdout_observations)],
                "approval": {"decision": decision["decision"], "reviewed_by": decision["reviewed_by_name"], "scope": decision["scope_id"],
                             "model_sha256": decision["approved_model"]["frozen_models_sha256"],
                             "record_path": str(Path(decision_path).resolve().relative_to(PROJECT)), "approved_claim": decision["approved_claim"]},
                "years": listing}
    (output / "manifest.json").write_text(json.dumps(manifest, indent=2, allow_nan=False, ensure_ascii=False) + "\n")
    return {"manifest": manifest, "harmonized_days": sum(row["harmonized"] is not None for days in years.values() for row in days)}


def export(*, observations, holdout_observations, output, decision_path=DECISION):
    decision, summary, frozen, cells = load_inputs(observations, holdout_observations, decision_path)
    model = frozen["models"][EXPERIMENT]
    holdout_dates = independent_holdout.holdout_dates(independent_holdout.load_plan())
    rows = daily_series(model, cells, holdout_dates)
    if not rows:
        raise ValueError("No complete Terra and Aqua date to export")
    acquired = sorted({cell["solar_date"] for cell in cells})
    roles = {}
    for row in rows:
        roles[row["sample_role"]] = roles.get(row["sample_role"], 0) + 1
    years = {}
    for row in rows:
        years[row["solar_date"][:4]] = years.get(row["solar_date"][:4], 0) + 1
    result = {"schema_version": SCHEMA, "region_id": decision["region_id"], "unit": "MW",
              "quantity": "S-NPP-equivalent daily fire radiative power sum estimated from Terra and Aqua MODIS",
              "status": "approved_plan_a", "approved_claim": decision["approved_claim"], "caveats": decision["caveats"],
              "publication_scope": decision["publication_scope"],
              "decision": {"registered_by": decision["registered_by"], "registered_at_utc": decision["registered_at_utc"],
                           "decision_sha256": file_hash(Path(decision_path))},
              "model": {"engine": frozen["engine_version"], "experiment": EXPERIMENT, "frozen_models_sha256": decision["approved_model"]["frozen_models_sha256"],
                        "method": model["suite"]["method"], "weights": model["weight_fit"]["weights"], "train_window": model["train_window"],
                        "pass_alignment": model["policy"]["pass_alignment"]},
              "independent_test": {key: summary["empirical_metrics"][EXPERIMENT]["Combined_Terra_Aqua"][key]
                                   for key in ("weekly_metrics", "naive_weekly_metrics_same_cohort", "paired_daily_count", "eligible_week_count",
                                               "picp_daily", "median_relative_interval_width")},
              "interpretation": {"interval": "Nominal 80% interval from training residual ratios; coverage is not guaranteed.",
                                 "is_extrapolated": "An input exceeded its stratum's training maximum; the interval is inflated.",
                                 "sample_role": {"training_window_in_sample": "The model was fitted on this window, so agreement with S-NPP here is not evidence.",
                                                 "post_hoc_examined_holdout": "After training, but examined before the v2 candidate was designed.",
                                                 "independent_holdout": "After training and never examined before the owner's registration."},
                                 "missing_dates": "A date absent from the series was not acquired or lacks a complete Terra or Aqua turn; it is not zero fire activity.",
                                 "snpp_observed_frp_mw": "Observed reference where both S-NPP turns exist; null otherwise."},
              "coverage": {"acquired_solar_dates": len(acquired), "first_acquired": acquired[0], "last_acquired": acquired[-1],
                           "exported_days": len(rows), "exported_days_by_year": dict(sorted(years.items())),
                           "exported_days_by_sample_role": dict(sorted(roles.items())),
                           "extrapolated_days": sum(row["is_extrapolated"] for row in rows)},
              "daily": rows, "weekly": weekly_series(rows)}
    result["series_sha256"] = fingerprint({"daily": result["daily"], "weekly": result["weekly"]})
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, indent=1, allow_nan=False) + "\n")
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--observations", type=Path, required=True, help="Examined observations.json the frozen model was fitted from")
    parser.add_argument("--holdout-observations", type=Path, required=True, help="Independent holdout observations.json")
    parser.add_argument("--output", type=Path, required=True, help="Evidence series JSON path")
    parser.add_argument("--app-output", type=Path, default=APP_OUTPUT, help="Browser contract directory")
    args = parser.parse_args()
    try:
        report = export(observations=args.observations, holdout_observations=args.holdout_observations, output=args.output)
        app = export_app(observations=args.observations, holdout_observations=args.holdout_observations, output=args.app_output)
    except (ValueError, OSError, KeyError):
        parser.exit(1, "Error: export refused; the decision, frozen model or observations failed validation.\n")
    print(json.dumps({"exported_days": report["coverage"]["exported_days"], "weeks": len(report["weekly"]), "series_sha256": report["series_sha256"],
                      "app_years": len(app["manifest"]["years"]), "app_days": sum(row["day_count"] for row in app["manifest"]["years"]),
                      "app_harmonized_days": app["harmonized_days"]}))
