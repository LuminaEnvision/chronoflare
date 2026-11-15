"""Delivery-3 SP quality audit; preserves raw rows and never approves harmonization."""
import argparse
from collections import Counter
import csv
from decimal import Decimal, InvalidOperation
import json
import math
from pathlib import Path
import re
import shutil
import sys
import tempfile

from normalize_detections import (NormalizationError, PLATFORMS, SATELLITES, VIIRS_CONFIDENCE, acquired_at, file_hash)

RULE_VERSION = "indicator-sp-quality/1.0.0"
CRITICAL = ("latitude", "longitude", "acq_date", "acq_time", "satellite", "instrument", "daynight", "frp", "confidence")


def text(value):
    return str(value).strip() if isinstance(value, (str, int, float, Decimal)) and not isinstance(value, bool) else ""


def finite(value):
    try:
        number = Decimal(text(value))
        return number if number.is_finite() and math.isfinite(float(number)) else None
    except (InvalidOperation, ValueError, OverflowError):
        return None


def classify_quality(raw, source, processing_level="SP"):
    if source not in PLATFORMS:
        raise ValueError("Unsupported explicit SP source")
    sensor, platforms = PLATFORMS[source]
    missing = [field for field in CRITICAL if not text(raw.get(field)) or text(raw.get(field)).lower() in ("null", "nan", "none", "inf", "infinity")]
    reasons = []
    numbers = {field: finite(raw.get(field)) for field in ("latitude", "longitude", "frp")}
    for field, number in numbers.items():
        if number is None and field not in missing:
            missing.append(field)
    if "acq_date" not in missing and "acq_time" not in missing:
        try:
            acquired_at({"acq_date": text(raw.get("acq_date")), "acq_time": text(raw.get("acq_time"))})
        except NormalizationError:
            missing.extend(field for field in ("acq_date", "acq_time") if field not in missing)
    if missing:
        reasons.append("missing_critical_field")
    latitude, longitude = numbers["latitude"], numbers["longitude"]
    if latitude is not None and longitude is not None and not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
        reasons.append("invalid_coordinates")
    if numbers["frp"] is None or numbers["frp"] <= 0:
        reasons.append("non_positive_frp")
    satellite = SATELLITES.get(re.sub(r"[\s_-]", "", text(raw.get("satellite"))).lower())
    instruments = {sensor, "SNPP"} if source == "VIIRS_SNPP_SP" else {sensor}
    if satellite not in platforms or text(raw.get("instrument")).upper() not in instruments:
        reasons.append("platform_instrument_mismatch")
    day_night = text(raw.get("daynight")).upper()
    if day_night not in ("D", "N"):
        reasons.append("invalid_day_night")
    source_type = finite(raw.get("type"))
    if source_type is None:
        reasons.append("unknown_source_type")
    elif source_type != source_type.to_integral_value() or source_type not in (0, 1, 2, 3):
        reasons.append("invalid_source_type")
    elif source_type != 0:
        reasons.append("non_vegetation_type")
    confidence_class = None
    if sensor == "MODIS":
        confidence = finite(raw.get("confidence"))
        if confidence is None or confidence != confidence.to_integral_value() or not 0 <= confidence <= 100:
            reasons.append("invalid_confidence")
        else:
            confidence_class = "low" if confidence < 30 else "nominal" if confidence < 80 else "high"
    else:
        confidence_class = VIIRS_CONFIDENCE.get(text(raw.get("confidence")).lower())
        if confidence_class is None:
            reasons.append("invalid_confidence")
    if confidence_class == "low":
        reasons.append("low_confidence")
    # NRT needs a separately registered/versioned static-source mask; no silent fallback.
    version = text(raw.get("version")).upper()
    declared = text(raw.get("processing_level")).upper()
    if (version and re.search(r"(?:NRT|URT|RT)$", version)) or (declared and declared != processing_level):
        reasons.append("processing_level_mismatch")
    if processing_level != "SP":
        reasons.insert(0, "nrt_static_mask_not_registered" if processing_level == "NRT" else "unsupported_processing_level")
    return {"quality_rule_version": RULE_VERSION, "quality_pass": not reasons,
            "quality_reasons": reasons, "missing_or_invalid_critical_fields": missing,
            "confidence_class": confidence_class, "sensor": sensor, "satellite": satellite,
            "day_night": day_night if day_night in ("D", "N") else None}


def audit_csv(*, input_path, source, output):
    if source not in PLATFORMS:
        raise NormalizationError("Choose an explicit supported SP source.")
    project = Path(__file__).resolve().parents[2]
    output = output.resolve()
    if output.exists() or any(output.is_relative_to(project / name) for name in ("app", "dist")):
        raise NormalizationError("Choose a new offline output directory outside app/ and dist/.")
    digest = file_hash(input_path)
    output.parent.mkdir(parents=True, exist_ok=True)
    staging = Path(tempfile.mkdtemp(prefix=".indicator-quality-", dir=output.parent))
    try:
        count = accepted = 0
        reasons, classes = Counter(), Counter()
        with input_path.open(encoding="utf-8-sig", newline="") as stream, (staging / "quality-audit.jsonl").open("w") as target:
            reader = csv.DictReader(stream, strict=True)
            if not reader.fieldnames:
                raise NormalizationError("CSV header is missing.")
            names = {name: name.strip().lower() for name in reader.fieldnames}
            if len(names) != len(reader.fieldnames) or len(set(names.values())) != len(names) or "" in names.values():
                raise NormalizationError("CSV contains ambiguous headers.")
            for index, raw in enumerate(reader, 1):
                if None in raw or any(value is None for value in raw.values()):
                    raise NormalizationError("CSV record length does not match its header.")
                result = classify_quality({names[key]: value for key, value in raw.items()}, source)
                count += 1
                accepted += result["quality_pass"]
                reasons.update(result["quality_reasons"])
                classes[result["confidence_class"] or "unknown"] += 1
                target.write(json.dumps({"source_dataset": source, "source_file_sha256": digest,
                                         "source_record": index, "raw_record": raw, **result}, allow_nan=False) + "\n")
        if file_hash(input_path) != digest:
            raise NormalizationError("Input changed during quality audit.")
        report = {"schema_version": "indicator-quality-audit/1.0.0", "quality_rule_version": RULE_VERSION,
                  "source_dataset": source, "source_file_sha256": digest, "record_count": count,
                  "quality_pass_count": accepted, "quality_fail_count": count - accepted,
                  "rejection_reason_counts": dict(reasons), "confidence_class_counts": dict(classes),
                  "scientific_status": "quality_audit_only", "harmonization_approved": False,
                  "notice": "Raw rows retained. No AOI cut, deduplication, aggregation, calibration or coverage inference. Rejection reasons can overlap; this is not an approved indicator dataset."}
        (staging / "report.json").write_text(json.dumps(report, indent=2) + "\n")
        output.mkdir()
        try:
            shutil.copytree(staging, output, dirs_exist_ok=True)
        except OSError:
            shutil.rmtree(output)
            raise
        return report
    except (UnicodeError, csv.Error):
        raise NormalizationError("Input must be structurally valid UTF-8 CSV.") from None
    finally:
        shutil.rmtree(staging)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", dest="input_path", type=Path, required=True)
    parser.add_argument("--source", choices=tuple(PLATFORMS), required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    try:
        result = audit_csv(**vars(args))
    except (NormalizationError, OSError):
        parser.exit(1, "Error: quality audit could not read, validate or save the CSV.\n")
    print(f"Audited {result['record_count']} source rows; {result['quality_pass_count']} pass the SP quality rule. No indicator approval or data publication was performed.")


if __name__ == "__main__":
    main()
