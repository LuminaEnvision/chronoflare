"""Temporal/same-turn preparation only; no fit, threshold selection or approval."""
import argparse
from collections import Counter
from dataclasses import asdict, dataclass
from datetime import date
import json
import math
from pathlib import Path
import sys

from normalize_detections import file_hash


@dataclass(frozen=True)
class Experiment:
    train_start: str
    train_end: str
    test_start: str
    test_end: str

    def __post_init__(self):
        for value in (self.train_start, self.train_end, self.test_start, self.test_end):
            calendar_date(value)
        if self.train_start > self.train_end or self.test_start > self.test_end:
            raise ValueError("Temporal windows must be ordered inclusive ranges")
        if max(self.train_start, self.test_start) <= min(self.train_end, self.test_end):
            raise ValueError("Training and test windows overlap")

    def split(self, value):
        calendar_date(value)
        if self.train_start <= value <= self.train_end:
            return "train"
        if self.test_start <= value <= self.test_end:
            return "test"
        return "outside"


def calendar_date(value):
    if not isinstance(value, str) or date.fromisoformat(value).isoformat() != value:
        raise ValueError("Expected a canonical YYYY-MM-DD solar date")
    return value


def experiment_from_protocol(protocol, name):
    if name not in ("forward", "backward_proxy"):
        raise ValueError("Choose an explicit forward or backward experiment")
    config = protocol["experiments"][name]
    if len(config["train"]) != 2 or len(config["test"]) != 2:
        raise ValueError("Expected two endpoints for each temporal window")
    return Experiment(*config["train"], *config["test"])


@dataclass(frozen=True)
class TurnObservation:
    region_id: str
    solar_date: str
    platform: str
    day_night: str
    metric: str
    value: float | None
    dataset_version: str
    quality_rule_version: str
    dedup_rule_version: str

    def __post_init__(self):
        calendar_date(self.solar_date)
        if self.platform not in ("Terra", "Aqua", "S-NPP", "NOAA-20") or self.day_night not in ("D", "N"):
            raise ValueError("Explicit platform and day/night turn are required")
        if self.metric not in ("frp_sum_mw", "detection_count"):
            raise ValueError("Unsupported observed indicator metric")
        for value in (self.region_id, self.dataset_version, self.quality_rule_version, self.dedup_rule_version):
            if not isinstance(value, str) or not value.strip():
                raise ValueError("Region, dataset, quality and deduplication versions are required")
        if self.value is not None:
            if isinstance(self.value, bool) or not isinstance(self.value, (int, float)) or not math.isfinite(self.value) or self.value <= 0:
                raise ValueError("Observed inputs must be positive finite values or null; never imputed zero")
            if self.metric == "detection_count" and int(self.value) != self.value:
                raise ValueError("Observed detection counts must be integral")

    @property
    def key(self):
        return (self.region_id, self.solar_date, self.day_night, self.metric)


def pair_observations(observations, predictor, target, experiment):
    """Pair compatible derived observations, never raw points or daily totals."""
    if (predictor, target) not in (("Terra", "S-NPP"), ("Aqua", "S-NPP")):
        raise ValueError("Unsupported explicit reference pair")
    observations = tuple(observations)
    versions = {(row.dataset_version, row.quality_rule_version, row.dedup_rule_version) for row in observations}
    if len(versions) > 1:
        raise ValueError("Mixed derived dataset or processing-rule versions cannot be paired")
    by_platform = {predictor: {}, target: {}}
    for row in observations:
        if row.platform not in by_platform:
            raise ValueError("Unexpected platform in explicitly scoped pairing input")
        records = by_platform[row.platform]
        if row.key in records:
            raise ValueError("Duplicate aggregate key; resolve upstream rather than summing")
        records[row.key] = row
    pairs, excluded = [], []
    for key in sorted(set(by_platform[predictor]) | set(by_platform[target])):
        left, right = by_platform[predictor].get(key), by_platform[target].get(key)
        split = experiment.split(key[1])
        reasons = []
        if split == "outside":
            reasons.append("outside_experiment")
        if left is None:
            reasons.append("missing_predictor_group")
        elif left.value is None:
            reasons.append("null_predictor")
        if right is None:
            reasons.append("missing_reference_group")
        elif right.value is None:
            reasons.append("null_reference")
        metadata = {"region_id": key[0], "solar_date": key[1], "day_night": key[2], "metric": key[3], "split": split}
        if reasons:
            excluded.append({**metadata, "reasons": reasons})
        else:
            pairs.append({**metadata, "predictor_platform": predictor, "reference_platform": target,
                          "predictor_value": left.value, "reference_value": right.value})
    return {"pairs": pairs, "excluded": excluded, "fit_performed": False, "validation_performed": False}


def assert_training_only(pairs, experiment):
    """Fail if any proposed fitting pair is test/outside data or mislabeled."""
    pairs = tuple(pairs)
    if not pairs:
        raise ValueError("Fitting requires paired training observations; registered sample thresholds still apply")
    for pair in pairs:
        if experiment.split(pair["solar_date"]) != "train" or pair["split"] != "train":
            raise ValueError("Fitting input contains held-out or out-of-experiment data")


def preview_readiness(preview, protocol):
    """Inventory the earlier frozen preview without pretending it is indicator input."""
    if protocol.get("schema_version") != "indicator-protocol-review/1.0.0" or preview.get("schema_version") != "experimental-solar/1.0.0":
        raise ValueError("Unsupported protocol or experimental preview schema")
    records = preview["records"]
    if not records:
        raise ValueError("Preview records cannot be empty")
    keys = set()
    for row in records:
        calendar_date(row["solar_date"])
        key = (row["solar_date"], row["platform"])
        if key in keys or row["platform"] not in ("Terra", "Aqua", "S-NPP"):
            raise ValueError("Preview contains a duplicate/unsupported calendar cell")
        keys.add(key)
    dates = sorted({row["solar_date"] for row in records})
    splits = {}
    for name in ("forward", "backward_proxy"):
        experiment = experiment_from_protocol(protocol, name)
        counts = Counter(experiment.split(value) for value in dates)
        splits[name] = {"windows": asdict(experiment), "distinct_solar_dates": {label: counts[label] for label in ("train", "test", "outside")}}
    dry = set(protocol["calibration"]["dry_months"])
    wet = set(protocol["calibration"]["wet_months"])
    if dry & wet or dry | wet != set(range(1, 13)):
        raise ValueError("Season definitions must partition all twelve months")
    metrics = {name: None for name in ("spearman_rho", "median_relative_bias", "mae", "picp_80_daily", "picp_80_weekly")}
    blockers = ["preview_has_no_day_night_aggregates", "preview_filter_is_not_the_delivery_3_indicator_rule", "preview_has_no_final_exact_deduplication"]
    for section, field in (("deduplication", "conflicting_value_resolution"), ("deduplication", "quality_vs_dedup_order"), ("deduplication", "coordinate_rounding_tie_rule"),
                           ("calibration", "missing_turn_estimate_policy"), ("calibration", "zero_mae_weight_policy"), ("calibration", "uncertainty_method"),
                           ("validation", "week_anchor"), ("validation", "minimum_paired_days_per_week"), ("validation", "weekly_statistic"), ("validation", "thresholds"), ("validation", "thresholds_registered_at")):
        if protocol[section].get(field) is None:
            blockers.append(f"unregistered_{section}_{field}")
    if splits["forward"]["distinct_solar_dates"]["train"] == 0:
        blockers.append("no_forward_training_dates")
    if splits["backward_proxy"]["distinct_solar_dates"]["test"] == 0:
        blockers.append("no_backward_test_dates")
    if not any(row["platform"] == "NOAA-20" for row in records):
        blockers.append("no_noaa20_sanity_input")
    seasons = {"dry": sum(int(value[5:7]) in dry for value in dates), "wet": sum(int(value[5:7]) in wet for value in dates)}
    for season, count in seasons.items():
        if count == 0:
            blockers.append(f"no_{season}_season_dates")
    return {
        "schema_version": "validation-preflight/1.0.0", "status": "blocked_for_fit_and_approval",
        "scope": "Frozen preview inventory only; not final quality-passed, deduplicated day/night observations",
        "first_solar_date": dates[0], "last_solar_date": dates[-1], "distinct_solar_dates": len(dates),
        "platform_day_counts": dict(Counter(row["platform"] for row in records)),
        "season_date_counts": seasons,
        "experiments": splits, "blockers": blockers, "paired_observations": None,
        "fit_allowed": False, "approval_allowed": False, "fit_performed": False, "validation_performed": False, "harmonization_approved": False,
        "results_by_view": {view: {"status": "not_run", **metrics} for view in protocol["validation"]["views"]},
        "notice": "Date availability is not measured observation coverage. No absent turn, pairing, weekly support, coefficient, uncertainty interval or approval is invented.",
    }


def write_readiness(*, preview, protocol, output):
    project = Path(__file__).resolve().parents[2]
    output = output.resolve()
    if output.exists() or any(output.is_relative_to(project / name) for name in ("app", "dist")):
        raise ValueError("Choose a new offline report path outside app/ and dist/")
    preview_hash, protocol_hash = file_hash(preview), file_hash(protocol)
    report = preview_readiness(json.loads(preview.read_text()), json.loads(protocol.read_text()))
    report["input_sha256"] = {"preview": preview_hash, "protocol": protocol_hash}
    if file_hash(preview) != preview_hash or file_hash(protocol) != protocol_hash:
        raise ValueError("Inputs changed during preflight")
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("x") as stream:
        stream.write(json.dumps(report, indent=2, allow_nan=False) + "\n")
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--preview", type=Path, required=True)
    parser.add_argument("--protocol", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    try:
        report = write_readiness(**vars(args))
    except (OSError, ValueError, KeyError, TypeError):
        parser.exit(1, "Error: cannot validate inputs or save preflight report.\n")
    print(f"Preflight complete: {report['distinct_solar_dates']} distinct solar dates; fitting and approval remain blocked.")


if __name__ == "__main__":
    main()
