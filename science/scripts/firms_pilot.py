"""Bounded August 2020 API intake, reference reconciliation and offline solar audit."""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
import json
import os
from pathlib import Path
import shutil
import sys
import tempfile

from shapely import intersects_xy, prepare
from shapely.geometry import shape

from firms_download import DownloadError, download_area
from normalize_detections import NormalizationError, canonical_decimal, file_hash, normalize_csv
from solar_time import RULE_VERSION, local_solar_date, solar_day_utc_window

REFERENCE_MANIFEST_SHA256 = "f9a7eacabff51dddfc490d9cd23dea90627ac10eb757d489f9dd04b2094ce43a"
BBOX = "-60,-23,-54,-15"
SOURCES = {"modis": "MODIS_SP", "viirs": "VIIRS_SNPP_SP"}
START, END = "2020-08-01", "2020-08-15"


def plan():
    """Six non-overlapping requests, each no longer than five UTC days."""
    return [
        {"id": f"{sensor}-{day}", "sensor": sensor, "source": source,
         "start": f"2020-08-{day:02d}", "days": 5, "bbox": BBOX}
        for sensor, source in SOURCES.items() for day in (1, 6, 11)
    ]


def write_json(path, value):
    path.write_text(json.dumps(value, indent=2, allow_nan=False) + "\n")


def checked_asset(root, metadata):
    path = (root / metadata["path"]).resolve()
    if not path.is_relative_to(root.resolve()) or path.stat().st_size != metadata["bytes"] or file_hash(path) != metadata["sha256"]:
        raise NormalizationError("Reference asset integrity check failed.")
    return json.loads(path.read_text())


def load_reference(root):
    manifest_path = root / "manifest.json"
    if file_hash(manifest_path) != REFERENCE_MANIFEST_SHA256:
        raise NormalizationError("Reference manifest does not match the pinned review package.")
    manifest = json.loads(manifest_path.read_text())
    region = manifest["pantanal"]
    polygon = shape(checked_asset(root, region["boundary"])["geometry"])
    if polygon.is_empty or not polygon.is_valid:
        raise NormalizationError("Reference boundary must be valid without repair.")
    west, south, east, north = map(float, BBOX.split(","))
    left, bottom, right, top = polygon.bounds
    if not (west <= left < right <= east and south <= bottom < top <= north):
        raise NormalizationError("API bounding box does not contain the entire reference polygon.")
    prepare(polygon)
    references = {}
    for sensor, source in SOURCES.items():
        info = region["sources"][sensor]
        if info["source_dataset"] != source:
            raise NormalizationError("Reference source does not match the API plan.")
        records = []
        for entry in info["days"]:
            shard = checked_asset(root, entry)
            if shard["date"] != entry["date"] or shard["source"] != sensor or len(shard["points"]) != entry["count"]:
                raise NormalizationError("Reference shard metadata mismatch.")
            for row in shard["points"]:
                records.append({
                    "acquired_at_utc": entry["date"] + "T" + row[3], "satellite": row[4],
                    "longitude": row[1], "latitude": row[2], "frp_mw": row[5],
                    "confidence_raw": row[6], "source_type": row[7],
                })
        if len(records) != info["record_count"]:
            raise NormalizationError("Reference count mismatch.")
        references[sensor] = {"records": records, "metadata": info}
    return polygon, references


def decimal_text(value):
    return canonical_decimal(Decimal(str(value)))


def signature(record, sensor):
    """Compare shared fields as multisets; do not collapse duplicate occurrences."""
    confidence = record["confidence_raw"].strip().lower()
    if sensor == "modis":
        confidence = decimal_text(confidence)
    else:
        confidence = {"l": "low", "n": "nominal", "h": "high"}.get(confidence, confidence)
    return (record["acquired_at_utc"], record["satellite"], decimal_text(record["longitude"]),
            decimal_text(record["latitude"]), decimal_text(record["frp_mw"]), confidence)


def compare_records(api, reference, sensor):
    actual = Counter(signature(row, sensor) for row in api)
    expected = Counter(signature(row, sensor) for row in reference)
    complete_types = all(row["source_type"] is not None for row in api + reference)
    typed_actual = Counter((signature(row, sensor), row["source_type"]) for row in api)
    typed_expected = Counter((signature(row, sensor), row["source_type"]) for row in reference)
    return {
        "api_region_records": len(api), "reference_region_records": len(reference),
        "shared_field_matches": sum((actual & expected).values()),
        "reference_only_occurrences": sum((expected - actual).values()),
        "api_only_occurrences": sum((actual - expected).values()),
        "difference_samples": {
            "reference_only": [{"fields": list(key), "occurrences": count} for key, count in sorted((expected - actual).items())[:10]],
            "api_only": [{"fields": list(key), "occurrences": count} for key, count in sorted((actual - expected).items())[:10]],
            "limit_per_side": 10,
        },
        "shared_fields_equal": actual == expected,
        "fields_compared": ["UTC timestamp", "platform", "longitude", "latitude", "FRP", "confidence"],
        "source_type_available_for_all_records": complete_types,
        "including_source_type_equal": typed_actual == typed_expected if complete_types else None,
        "api_duplicate_shared_field_occurrences": len(api) - len(actual),
        "reference_duplicate_shared_field_occurrences": len(reference) - len(expected),
    }


def daily_audit(records, platforms):
    groups = defaultdict(list)
    for row in records:
        groups[(row["satellite"], local_solar_date(row["acquired_at_utc"]))].append(row)
    utc_start = datetime(2020, 8, 1, tzinfo=timezone.utc)
    utc_end = datetime(2020, 8, 16, tzinfo=timezone.utc)
    result = []
    # The first UTC hours belong to July 31 in regional mean solar time.
    for index in range(16):
        day = (date(2020, 7, 31) + timedelta(days=index)).isoformat()
        start, end = solar_day_utc_window(day)
        for platform in platforms:
            rows = groups[(platform, day)]
            result.append({
                "solar_date": day, "platform": platform,
                "period_start_utc": start.isoformat(), "period_end_utc_exclusive": end.isoformat(),
                "request_contains_complete_solar_day": utc_start <= start and end <= utc_end,
                "returned_detection_count": len(rows),
                "positive_detection_count": len(rows) if rows else None,
                "raw_frp_sum_mw": float(sum((Decimal(str(row["frp_mw"])) for row in rows), Decimal(0))) if rows else None,
                "coverage_status": "unknown", "overpass_count": None,
            })
    return result


def run_pilot(*, output, reference, map_key, downloader=download_area):
    output = output.resolve()
    project = Path(__file__).resolve().parents[2]
    if output.exists() or any(output.is_relative_to(project / folder) for folder in ("app", "dist")):
        raise NormalizationError("Choose a new offline output directory outside app/ and dist/.")
    if not map_key:
        raise DownloadError("Set FIRMS_MAP_KEY before running the pilot.")
    polygon, references = load_reference(reference)
    output.parent.mkdir(parents=True, exist_ok=True)
    staging = Path(tempfile.mkdtemp(prefix=".firms-pilot-", dir=output.parent))
    try:
        downloads, rows_by_sensor, lineage = [], defaultdict(list), []
        for request in plan():
            raw = staging / "raw" / request["id"]
            metadata = downloader(source=request["source"], bbox=request["bbox"], start=request["start"], days=request["days"], output=raw, map_key=map_key)
            normalized = staging / "normalized" / request["id"]
            report = normalize_csv(input_path=raw / "detections.csv", source=request["source"], output=normalized, provenance=raw / "provenance.json")
            records = [json.loads(line) for line in (normalized / "detections.jsonl").read_text().splitlines()]
            mask = intersects_xy(polygon, [row["longitude"] for row in records], [row["latitude"] for row in records]) if records else []
            for row, inside in zip(records, mask):
                if inside:
                    rows_by_sensor[request["sensor"]].append(row)
                    lineage.append({**row, "region_id": "pantanal_ibge_2025_reference", "local_solar_date": local_solar_date(row["acquired_at_utc"]), "request_id": request["id"]})
            downloads.append({**request, "download": metadata, "normalization": report,
                              "region_record_count": int(sum(mask))})
        sources = {}
        daily = []
        for sensor in SOURCES:
            rows = rows_by_sensor[sensor]
            sources[sensor] = {
                **compare_records(rows, references[sensor]["records"], sensor),
                "reference_input_sha256": references[sensor]["metadata"]["input_sha256"],
                "reference_collection_values": references[sensor]["metadata"]["collection_values"],
                "api_collection_values": sorted({row["collection"] for row in rows if row["collection"] is not None}),
                "platform_counts": dict(Counter(row["satellite"] for row in rows)),
                "confidence_counts": dict(Counter(row["confidence_raw"] for row in rows)),
                "source_type_counts": dict(Counter(row["source_type"] or "missing" for row in rows)),
                "missing_day_night_count": sum(row["day_night"] is None for row in rows),
            }
            daily.extend(daily_audit(rows, ["Terra", "Aqua"] if sensor == "modis" else ["S-NPP"]))
        result = {
            "schema_version": "firms-pilot-audit/1.0.0", "scientific_status": "unreviewed",
            "coverage_status": "unknown", "start_utc_date": START, "end_utc_date_inclusive": END,
            "reference_manifest_sha256": REFERENCE_MANIFEST_SHA256, "solar_rule_version": RULE_VERSION,
            "region_rule": "Point centres inside or exactly on the pinned IBGE 2025 reference polygon; no buffer.",
            "downloads": downloads, "sources": sources,
            "notice": "Offline audit only. No quality filtering, deduplication, coverage approval or public data update. Raw FRP sums combine observations across passes; they are not energy, area burned or a harmonized activity metric.",
        }
        write_json(staging / "audit.json", result)
        write_json(staging / "daily-audit.json", daily)
        with (staging / "regional-detections.jsonl").open("w") as stream:
            for row in lineage:
                stream.write(json.dumps(row, allow_nan=False) + "\n")
        shutil.rmtree(staging / "normalized")
        output.mkdir()
        try:
            for item in staging.iterdir():
                item.rename(output / item.name)
        except OSError:
            shutil.rmtree(output)
            raise
        return result
    finally:
        shutil.rmtree(staging)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    try:
        result = run_pilot(output=args.output, reference=Path(__file__).resolve().parents[2] / "app/public/data/detection-review/v1", map_key=os.environ.get("FIRMS_MAP_KEY"))
    except (DownloadError, NormalizationError) as error:
        parser.exit(1, f"Error: {error}\n")
    except (OSError, ValueError, KeyError):
        parser.exit(1, "Error: cannot read, validate or save the pilot package.\n")
    for sensor, info in result["sources"].items():
        print(f"{sensor}: {info['api_region_records']} regional records; shared-field equality: {info['shared_fields_equal']}.")
        print(json.dumps({"source": sensor, "audit": info}, sort_keys=True))


if __name__ == "__main__":
    main()
