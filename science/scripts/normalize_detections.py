"""Normalize local FIRMS SP CSVs into traceable, unreviewed raw detections.

This technical adapter does not filter confidence/type, infer coverage or solar
dates, assign an AOI, combine satellites, or create frontend aggregates.
"""

from __future__ import annotations

import argparse
import csv
from datetime import date, datetime, timezone
from decimal import Decimal, InvalidOperation
import hashlib
import json
import math
from pathlib import Path
import re
import shutil
import sys
import tempfile

from firms_download import SOURCES

NORMALIZATION_VERSION = "1.0.1"
REQUIRED = {"latitude", "longitude", "acq_date", "acq_time", "satellite", "confidence", "frp"}
PLATFORMS = {
    "MODIS_SP": ("MODIS", {"Terra", "Aqua"}),
    "VIIRS_SNPP_SP": ("VIIRS", {"S-NPP"}),
    "VIIRS_NOAA20_SP": ("VIIRS", {"NOAA-20"}),
    "VIIRS_NOAA21_SP": ("VIIRS", {"NOAA-21"}),
}
SATELLITES = {
    "t": "Terra", "terra": "Terra", "a": "Aqua", "aqua": "Aqua",
    "n": "S-NPP", "snpp": "S-NPP", "suominpp": "S-NPP",
    "n20": "NOAA-20", "noaa20": "NOAA-20",
    "n21": "NOAA-21", "noaa21": "NOAA-21",
}
VIIRS_CONFIDENCE = {"l": "low", "low": "low", "n": "nominal", "nominal": "nominal", "h": "high", "high": "high"}


class NormalizationError(Exception):
    """A technical input error that does not echo raw record values."""


def file_hash(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def decimal_value(value: str, field: str, minimum=None, maximum=None) -> Decimal:
    try:
        result = Decimal(value.strip())
    except (InvalidOperation, AttributeError):
        raise NormalizationError(f"{field}: expected a finite number.") from None
    if not result.is_finite() or not math.isfinite(float(result)):
        raise NormalizationError(f"{field}: expected a finite number.")
    if (minimum is not None and result < minimum) or (maximum is not None and result > maximum):
        raise NormalizationError(f"{field}: value is outside the allowed range.")
    return result


def canonical_decimal(value: Decimal) -> str:
    # Hash equivalent coordinate spellings identically without float rounding.
    if value == 0:
        return "0"
    text = format(value, "f")
    return text.rstrip("0").rstrip(".") if "." in text else text


def optional_size(row: dict, field: str):
    value = row.get(field, "").strip()
    if not value:
        return None
    result = decimal_value(value, field, minimum=0)
    if result == 0:
        raise NormalizationError(f"{field}: pixel size must be positive.")
    return float(result)


def acquired_at(row: dict) -> str:
    try:
        day = row["acq_date"].strip()
        parsed = date.fromisoformat(day)
        clock = row["acq_time"].strip()
        if day != parsed.isoformat() or not re.fullmatch(r"[0-9]{1,4}", clock):
            raise ValueError()
        clock = clock.zfill(4)
        timestamp = datetime(parsed.year, parsed.month, parsed.day, int(clock[:2]), int(clock[2:]), tzinfo=timezone.utc)
        return timestamp.isoformat().replace("+00:00", "Z")
    except ValueError:
        raise NormalizationError("Acquisition date/time must be a valid ISO date and UTC HHMM time.") from None


def normalize_record(row: dict, raw: dict, source: str, source_hash: str, index: int, *, retain_negative_frp=False) -> dict:
    sensor, allowed = PLATFORMS[source]
    satellite = SATELLITES.get(re.sub(r"[\s_-]", "", row["satellite"]).lower())
    if satellite not in allowed:
        raise NormalizationError("Satellite does not match the declared source.")
    instrument = row.get("instrument", "").strip().upper()
    # FIRMS SUOMI VIIRS C2 archive exports can label the instrument as SNPP.
    allowed_instruments = {sensor, "SNPP"} if source == "VIIRS_SNPP_SP" else {sensor}
    if instrument and instrument not in allowed_instruments:
        raise NormalizationError("Instrument does not match the declared source.")

    version = row.get("version", "").strip()
    collection = None
    if version:
        match = re.fullmatch(r"([0-9]+(?:\.[0-9]+)*)(NRT|URT|RT)?", version.upper())
        if not match:
            raise NormalizationError("Unrecognized product version; collection cannot be inferred safely.")
        if match.group(2):
            raise NormalizationError("Non-SP record conflicts with the declared SP source.")
        collection = match.group(1)

    lat = decimal_value(row["latitude"], "latitude", -90, 90)
    lon = decimal_value(row["longitude"], "longitude", -180, 180)
    frp = decimal_value(row["frp"], "frp", None if retain_negative_frp else 0)
    timestamp = acquired_at(row)
    confidence = row["confidence"].strip()
    if sensor == "MODIS":
        decimal_value(confidence, "confidence", 0, 100)
        confidence_class = None  # No unapproved numeric class boundaries.
    else:
        confidence_class = VIIRS_CONFIDENCE.get(confidence.lower())
        if confidence_class is None:
            raise NormalizationError("Unrecognized VIIRS confidence class.")

    day_night = row.get("daynight", "").strip().upper() or None
    if day_night not in (None, "D", "N"):
        raise NormalizationError("daynight must be D or N when provided.")
    source_type = row.get("type", "").strip() or None
    if source_type is not None and source_type not in ("0", "1", "2", "3"):
        raise NormalizationError("type must be 0, 1, 2, or 3 when provided.")

    identity = [sensor, satellite, timestamp, canonical_decimal(lat), canonical_decimal(lon)]
    detection_id = hashlib.sha256(json.dumps(identity, separators=(",", ":")).encode()).hexdigest()
    return {
        "detection_id": detection_id, "source_dataset": source, "collection": collection,
        "processing_level": "SP", "sensor": sensor, "satellite": satellite,
        "latitude": float(lat), "longitude": float(lon), "acquired_at_utc": timestamp,
        "local_solar_date": None, "day_night": day_night, "frp_mw": float(frp),
        "scan": optional_size(row, "scan"), "track": optional_size(row, "track"),
        "source_type": source_type, "confidence_raw": row["confidence"],
        "confidence_class": confidence_class, "region_id": None, "cell_id": None,
        "quality_pass": None, "quality_rule_version": None,
        "normalization_version": "1.1.0-audit" if retain_negative_frp else NORMALIZATION_VERSION,
        "source_file_sha256": source_hash, "source_record": index,
        "raw_record": raw,
    }


def load_provenance(path: Path | None, source: str, digest: str, size: int) -> dict:
    if path is None:
        return {}
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (ValueError, UnicodeError):
        raise NormalizationError("Provenance must be a valid JSON object.") from None
    if not isinstance(value, dict):
        raise NormalizationError("Provenance must be a JSON object.")
    if value.get("sha256") != digest or value.get("source") != source or value.get("processing_level") != "SP":
        raise NormalizationError("Input hash/source/processing conflicts with provenance.")
    if "bytes" in value and value["bytes"] != size:
        raise NormalizationError("Input size conflicts with provenance.")
    if "row_count" in value and (type(value["row_count"]) is not int or value["row_count"] < 0):
        raise NormalizationError("Provenance row_count must be a nonnegative integer.")
    retrieved = value.get("retrieved_at_utc")
    if retrieved is not None:
        try:
            timestamp = datetime.fromisoformat(retrieved)
            if timestamp.utcoffset() is None or timestamp.utcoffset().total_seconds() != 0:
                raise ValueError()
        except (ValueError, TypeError):
            raise NormalizationError("Provenance retrieval time must be an explicit UTC timestamp.") from None
    # Do not propagate arbitrary metadata, URLs, or credentials into new reports.
    return {key: value[key] for key in ("row_count", "retrieved_at_utc", "collection") if key in value}


def normalize_csv(*, input_path: Path, source: str, output: Path, provenance: Path | None = None, retain_negative_frp=False) -> dict:
    if type(retain_negative_frp) is not bool:
        raise NormalizationError("Raw FRP retention policy must be an explicit boolean.")
    if source not in PLATFORMS:
        raise NormalizationError("Choose a supported FIRMS SP source.")
    project = Path(__file__).resolve().parents[2]
    output = output.resolve()
    if output.is_relative_to(project / "app") or output.is_relative_to(project / "dist"):
        raise NormalizationError("Unreviewed detections cannot be written into app/ or dist/.")
    if output.exists():
        raise NormalizationError("Output already exists; choose a new directory.")
    digest = file_hash(input_path)
    metadata = load_provenance(provenance, source, digest, input_path.stat().st_size)
    output.parent.mkdir(parents=True, exist_ok=True)
    staging = Path(tempfile.mkdtemp(prefix=".normalize-", dir=output.parent))
    try:
        count = duplicates = missing_collection = missing_type = missing_day_night = negative_frp = 0
        identities, collections = set(), set()
        first = last = None
        with input_path.open("r", encoding="utf-8-sig", newline="") as stream, (staging / "detections.jsonl").open("w", encoding="utf-8", newline="\n") as target:
            reader = csv.DictReader(stream, strict=True)
            if not reader.fieldnames:
                raise NormalizationError("CSV header is missing.")
            headers = {name: name.strip().lower() for name in reader.fieldnames}
            if "" in headers.values() or len(headers) != len(reader.fieldnames) or len(set(headers.values())) != len(headers):
                raise NormalizationError("CSV contains duplicate or ambiguous headers.")
            if not REQUIRED.issubset(headers.values()):
                raise NormalizationError("CSV is missing required FIRMS detection columns.")
            for index, raw in enumerate(reader, start=1):
                if None in raw or any(value is None for value in raw.values()):
                    raise NormalizationError(f"Record {index}: column count does not match the header.")
                row = {headers[key]: value for key, value in raw.items()}
                try:
                    record = normalize_record(row, raw, source, digest, index, retain_negative_frp=retain_negative_frp)
                except NormalizationError as error:
                    raise NormalizationError(f"Record {index}: {error}") from None
                if record["detection_id"] in identities:
                    duplicates += 1
                identities.add(record["detection_id"])
                if record["collection"] is not None:
                    collections.add(record["collection"])
                missing_collection += record["collection"] is None
                missing_type += record["source_type"] is None
                missing_day_night += record["day_night"] is None
                negative_frp += record["frp_mw"] < 0
                stamp = record["acquired_at_utc"]
                first = stamp if first is None else min(first, stamp)
                last = stamp if last is None else max(last, stamp)
                target.write(json.dumps(record, ensure_ascii=False, allow_nan=False, sort_keys=True, separators=(",", ":")) + "\n")
                count += 1
        if "row_count" in metadata and metadata["row_count"] != count:
            raise NormalizationError("Parsed record count conflicts with provenance.")
        if file_hash(input_path) != digest:
            raise NormalizationError("Input changed during normalization; retry with a stable source file.")
        report = {
            "schema_version": "raw-detection/1.0.0", "normalization_version": "1.1.0-audit" if retain_negative_frp else NORMALIZATION_VERSION,
            "normalized_at_utc": datetime.now(timezone.utc).isoformat(),
            "source_dataset": source, "processing_level": "SP",
            "input_file": input_path.name, "input_sha256": digest,
            "input_provenance_verified": provenance is not None,
            "retrieved_at_utc": metadata.get("retrieved_at_utc"),
            "record_count": count, "duplicate_identity_count": duplicates,
            "raw_frp_policy": "retain_finite_negative_for_quality_audit" if retain_negative_frp else "nonnegative_only", "negative_frp_row_count": negative_frp,
            "collections": sorted(collections), "missing_collection_count": missing_collection,
            "missing_source_type_count": missing_type, "missing_day_night_count": missing_day_night,
            "actual_acquisition_range_utc": {"start": first, "end": last} if first else None,
            "output_file": "detections.jsonl", "output_sha256": file_hash(staging / "detections.jsonl"),
            "scientific_status": "unreviewed", "coverage_status": "unknown",
            "notice": "All technically valid input records are retained, including low-confidence, static-source and duplicate detections. No scientific approval or frontend export was performed.",
            "pending_steps": ["AOI filtering", "local solar dates", "quality rules", "coverage assessment", "platform combination", "H3 aggregation", "calibration and validation", "frontend export"],
        }
        (staging / "report.json").write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        output.mkdir()
        try:
            for item in staging.iterdir():
                item.rename(output / item.name)
        except OSError:
            shutil.rmtree(output)
            raise
        return report
    except (UnicodeError, csv.Error):
        raise NormalizationError("Input must be a valid UTF-8 FIRMS CSV.") from None
    finally:
        shutil.rmtree(staging)


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", dest="input_path", type=Path, required=True)
    parser.add_argument("--source", choices=SOURCES, required=True)
    parser.add_argument("--provenance", type=Path, help="Optional provenance.json from the FIRMS downloader")
    parser.add_argument("--output", type=Path, required=True, help="New local directory outside app/ and dist/")
    args = parser.parse_args(argv)
    try:
        report = normalize_csv(**vars(args))
    except NormalizationError as error:
        print(f"Error: {error}", file=sys.stderr)
        return 1
    except OSError:
        print("Error: cannot read input/provenance or save output; check paths and permissions.", file=sys.stderr)
        return 1
    print(f"Normalized {report['record_count']} unreviewed detections; {report['duplicate_identity_count']} repeated identities retained. Scientific rules and coverage are pending.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
