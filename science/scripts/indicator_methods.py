"""Delivery-3 v1.1 deterministic primitives; no fitted parameter or model approval."""
from collections import defaultdict
from datetime import date, timedelta
import math

from indicator_quality import classify_quality
from solar_time import parse_utc, local_solar_date
from normalize_detections import acquired_at

DEDUP_VERSION = "indicator-exact-key/python-float64-round-1.1.0"


def positive(value):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value <= 0:
        raise ValueError("Expected a positive finite observed or calibrated value")
    return float(value)


def duplicate_key(row):
    latitude, longitude = float(row["latitude"]), float(row["longitude"])
    if not math.isfinite(latitude) or not math.isfinite(longitude) or not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
        raise ValueError("Invalid coordinates")
    return (row["sensor"], row["satellite"], parse_utc(row["acquired_at_utc"]).isoformat(), round(latitude, 5), round(longitude, 5))


def winner_priority(row):
    if row["processing_level"] not in ("SP", "NRT"):
        raise ValueError("Unsupported processing level")
    confidence = float(row["confidence_raw"]) if row["sensor"] == "MODIS" else {"nominal": 1, "high": 2}[row["confidence_class"]]
    return (0 if row["processing_level"] == "SP" else 1, -positive(row["frp_mw"]), -confidence,
            row["detection_id"], row["source_file_sha256"], row["source_record"])


def quality_then_deduplicate(rows):
    """Recompute current quality first; retain all rejected/duplicate source rows."""
    audited = []
    groups = defaultdict(list)
    for ordinal, row in enumerate(rows):
        raw = {key.strip().lower(): value for key, value in row["raw_record"].items()}
        quality = classify_quality(raw, row["source_dataset"], row["processing_level"])
        value = {**row, **quality, "input_ordinal": ordinal, "indicator_included": False,
                 "indicator_exclusion": "quality_rejected", "duplicate_winner": None}
        audited.append(value)
        if quality["quality_pass"]:
            if (float(raw["frp"]) != row["frp_mw"] or float(raw["latitude"]) != row["latitude"] or float(raw["longitude"]) != row["longitude"]
                or parse_utc(acquired_at(raw)) != parse_utc(row["acquired_at_utc"])
                or row["local_solar_date"] != local_solar_date(row["acquired_at_utc"])):
                raise ValueError("Normalized critical values do not match their original source row")
            groups[duplicate_key(value)].append(value)
    winners = []
    for key in sorted(groups):
        group = groups[key]
        winner = min(group, key=winner_priority)
        winners.append(winner)
        for row in group:
            row["indicator_included"] = row is winner
            row["indicator_exclusion"] = None if row is winner else "duplicate_key"
            if row is not winner:
                row["duplicate_winner"] = {"detection_id": winner["detection_id"], "source_file_sha256": winner["source_file_sha256"], "source_record": winner["source_record"]}
    return winners, audited


def observed_turns(winners, start, end):
    first, last = date.fromisoformat(start), date.fromisoformat(end)
    if first > last:
        raise ValueError("Observed date range is reversed")
    groups = defaultdict(list)
    regions = set()
    for row in winners:
        if row["satellite"] not in ("Terra", "Aqua", "S-NPP") or not row.get("region_id"):
            raise ValueError("Explicit supported platform and region are required")
        regions.add(row["region_id"])
        if len(regions) > 1:
            raise ValueError("Regions must not be combined in one observed aggregate")
        if not row["indicator_included"] or not row["quality_pass"]:
            raise ValueError("Aggregation requires selected quality-passing winners")
        if row["day_night"] not in ("D", "N") or not start <= row["local_solar_date"] <= end:
            raise ValueError("Row is outside the explicit turn/date scope")
        groups[(row["satellite"], row["local_solar_date"], row["day_night"])].append(row)
    output = []
    for offset in range((last - first).days + 1):
        day = (first + timedelta(days=offset)).isoformat()
        for platform in ("Terra", "Aqua", "S-NPP"):
            for turn in ("D", "N"):
                rows = groups[(platform, day, turn)]
                output.append({"solar_date": day, "platform": platform, "day_night": turn,
                               "observed_frp_sum_mw": math.fsum(positive(row["frp_mw"]) for row in rows) if rows else None,
                               "observed_detection_count": len(rows) if rows else None,
                               "coverage_status": "unknown", "coverage_fraction": None, "overpass_count": None})
    return output


def inverse_mae_weights(terra_mae, aqua_mae):
    for value in (terra_mae, aqua_mae):
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value < 0:
            raise ValueError("OOF training MAE must be finite and nonnegative")
    terra, aqua = max(terra_mae, 1e-6), max(aqua_mae, 1e-6)
    scale = max(terra, aqua)
    aqua_weight = (terra / scale) / (terra / scale + aqua / scale)
    return {"Terra": 1 - aqua_weight, "Aqua": aqua_weight}


def complete_daily(turns):
    if set(turns) != {"D", "N"}:
        raise ValueError("Explicit D and N slots are required")
    for value in turns.values():
        if value is not None:
            positive(value)
    return math.fsum(turns.values()) if all(value is not None for value in turns.values()) else None


def combine_daily(terra_turns, aqua_turns, weights=None):
    terra, aqua = complete_daily(terra_turns), complete_daily(aqua_turns)
    if terra is not None and aqua is not None:
        if weights is None or set(weights) != {"Terra", "Aqua"}:
            raise ValueError("Both complete platforms require explicit fitted weights")
        if any(isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value < 0 or value > 1 for value in weights.values()) or not math.isclose(math.fsum(weights.values()), 1., rel_tol=0., abs_tol=1e-12):
            raise ValueError("Weights must form a nonnegative convex combination")
        return {"value": math.fsum([weights["Terra"] * terra, weights["Aqua"] * aqua]), "regime": "Terra+Aqua_weighted"}
    if aqua is not None:
        return {"value": aqua, "regime": "Aqua_only"}
    if terra is not None:
        return {"value": terra, "regime": "Terra_only"}
    return {"value": None, "regime": "no_complete_platform"}


def training_sample_floor(dates, experiment):
    dates = sorted(set(dates))
    if any(experiment.split(day) != "train" for day in dates):
        raise ValueError("Stratum support includes held-out or outside dates")
    years = len({day[:4] for day in dates})
    return {"paired_positive_dates": len(dates), "distinct_training_years": years,
            "meets_registered_sample_floor": len(dates) >= 30 and years >= 3,
            "fit_performed": False, "harmonization_approved": False}


def paired_iso_weeks(rows, start, end_exclusive):
    """Report both specified weekly scales; do not silently choose MAE units."""
    first, end = date.fromisoformat(start), date.fromisoformat(end_exclusive)
    if first >= end:
        raise ValueError("Expected a nonempty half-open weekly scope")
    grouped, seen = defaultdict(list), set()
    for row in rows:
        day = date.fromisoformat(row["solar_date"])
        if day.isoformat() != row["solar_date"] or not first <= day < end or day in seen:
            raise ValueError("Duplicate, noncanonical or out-of-scope daily pair")
        seen.add(day)
        for field in ("observed", "estimated"):
            if row[field] is not None:
                positive(row[field])
        monday = day - timedelta(days=day.weekday())
        grouped[monday].append(row)
    weeks = []
    monday = first - timedelta(days=first.weekday())
    while monday < end:
        available = grouped[monday]
        pairs = sorted((row for row in available if row["observed"] is not None and row["estimated"] is not None), key=lambda row: row["solar_date"])
        count = len(pairs)
        sums = {field: math.fsum(row[field] for row in pairs) if pairs else None for field in ("observed", "estimated")}
        weeks.append({"period_start": monday.isoformat(), "period_end_exclusive": (monday + timedelta(days=7)).isoformat(),
                      "iso_year": monday.isocalendar().year, "iso_week": monday.isocalendar().week,
                      "paired_days": [row["solar_date"] for row in pairs], "paired_day_count": count,
                      "paired_day_fraction": count / 7, "eligible_weekly_support": count >= 5,
                      "paired_sums_audit": sums,
                      "paired_daily_means": {field: sums[field] / count if count >= 5 else None for field in sums},
                      "seven_day_equivalents": {field: sums[field] * 7 / count if count >= 5 else None for field in sums},
                      "validation_statistic_selected": None, "observation_coverage": "unknown"})
        monday += timedelta(days=7)
    return weeks
