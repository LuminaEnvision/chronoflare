"""Prepare a separate unreviewed solar calendar with explicit proposed quality rules."""
import argparse
from collections import Counter
from datetime import date, timedelta
import json
import os
from pathlib import Path
import shutil
import sys
import tempfile

from shapely import intersects_xy

from coverage_evidence import day_evidence
from firms_download import DownloadError, download_area
from firms_pilot import BBOX, SOURCES, cached_downloader, load_reference, run_pilot, write_json
from normalize_detections import NormalizationError, normalize_csv
from solar_time import RULE_VERSION, local_solar_date, solar_day_utc_window

QUALITY_RULE = {
    "id": "vegetation-candidate/1.0.0", "status": "proposed_unapproved",
    "type": "0 only", "modis_confidence_minimum": 30,
    "viirs_confidence_classes": ["nominal", "high"],
    "missing_fields": "indeterminate; not selected", "deduplication": "none",
}


def candidate_quality(row):
    reasons = []
    if row["source_type"] is None:
        reasons.append("missing_source_type")
    elif row["source_type"] != "0":
        reasons.append("nonzero_source_type")
    if row["sensor"] == "MODIS":
        if float(row["confidence_raw"]) < 30:
            reasons.append("low_confidence")
    elif row["confidence_class"] not in ("nominal", "high"):
        reasons.append("low_confidence")
    return not reasons, reasons


def summarize(rows):
    if not rows:
        return {"detection_count": None, "raw_frp_sum_mw": None}
    # A raw sum is an audit statistic, never a background observation or energy.
    from decimal import Decimal
    value = sum((Decimal(str(row["frp_mw"])) for row in rows), Decimal(0))
    return {"detection_count": len(rows), "raw_frp_sum_mw": float(value) if value > 0 else None}


def preview_rows(records):
    output = []
    for offset in range(15):
        day = (date(2020, 8, 1) + timedelta(days=offset)).isoformat()
        start, end = solar_day_utc_window(day)
        for platform in ("Terra", "Aqua", "S-NPP"):
            rows = [row for row in records if row["local_solar_date"] == day and row["satellite"] == platform]
            selected = [row for row in rows if row["candidate_quality_pass"]]
            rejected = Counter(reason for row in rows for reason in row["candidate_quality_reasons"])
            evidence = day_evidence(platform, day)
            output.append({
                "solar_date": day, "platform": platform,
                "period_start_utc": start.isoformat(), "period_end_utc_exclusive": end.isoformat(),
                "input_window_complete": True, "coverage_status": "unknown",
                "coverage_fraction": None, "overpass_count": None,
                "operational_state": evidence["operational_state"],
                "all_detections": summarize(rows), "proposed_filter": summarize(selected),
                "rejected_record_count": len(rows) - len(selected), "rejection_reason_counts": dict(rejected),
            })
    return output


def prepare_preview(*, evidence, output, map_key, downloader=download_area):
    project = Path(__file__).resolve().parents[2]
    output = output.resolve()
    if output.exists() or any(output.is_relative_to(project / name) for name in ("app", "dist")):
        raise NormalizationError("Choose a new offline output directory outside app/ and dist/.")
    if not map_key:
        raise DownloadError("Set FIRMS_MAP_KEY to fetch the two padding requests.")
    reference = project / "app/public/data/detection-review/v1"
    polygon, _ = load_reference(reference)
    output.parent.mkdir(parents=True, exist_ok=True)
    staging = Path(tempfile.mkdtemp(prefix=".solar-preview-", dir=output.parent))
    try:
        base = staging / "base"
        audit = run_pilot(output=base, reference=reference, map_key="offline-replay", downloader=cached_downloader(evidence))
        rows = [json.loads(line) for line in (base / "regional-detections.jsonl").read_text().splitlines()]
        padding = []
        for sensor, source in SOURCES.items():
            raw = base / "raw" / f"{sensor}-16"
            metadata = downloader(source=source, bbox=BBOX, start="2020-08-16", days=1, output=raw, map_key=map_key)
            normalized = staging / "normalized" / sensor
            normalize_csv(input_path=raw / "detections.csv", source=source, output=normalized, provenance=raw / "provenance.json")
            extra = [json.loads(line) for line in (normalized / "detections.jsonl").read_text().splitlines()]
            inside = intersects_xy(polygon, [row["longitude"] for row in extra], [row["latitude"] for row in extra]) if extra else []
            for row, keep in zip(extra, inside):
                if keep:
                    rows.append({**row, "local_solar_date": local_solar_date(row["acquired_at_utc"]),
                                 "request_id": f"{sensor}-16", "region_id": "pantanal_ibge_2025_reference"})
            padding.append(metadata)
        selected_rows = []
        for row in rows:
            if "2020-08-01" <= row["local_solar_date"] <= "2020-08-15":
                passed, reasons = candidate_quality(row)
                selected_rows.append({**row, "candidate_quality_pass": passed,
                                      "candidate_quality_reasons": reasons, "candidate_quality_rule": QUALITY_RULE["id"]})
        csv_provenance = [entry["download"] for entry in audit["downloads"]] + padding
        preview = {
            "schema_version": "experimental-solar/1.0.0", "status": "real_unreviewed",
            "scientific_approval": False, "approved_metric": False,
            "region_id": "pantanal_ibge_2025_reference", "reference_manifest_sha256": audit["reference_manifest_sha256"],
            "start_solar_date": "2020-08-01", "end_solar_date_inclusive": "2020-08-15",
            "solar_rule_version": RULE_VERSION, "solar_offset_seconds": -13596,
            "source_utc_start": "2020-08-01T00:00:00Z", "source_utc_end_exclusive": "2020-08-17T00:00:00Z",
            "quality_rule": QUALITY_RULE, "input_csv_sha256": [item["sha256"] for item in csv_provenance],
            "provenance": [{key: value for key, value in item.items() if key in ("source", "sha256", "retrieved_at_utc", "requested_start_utc", "requested_end_utc_inclusive", "row_count")} for item in csv_provenance],
            "reference_reconciliation": {sensor: {key: info[key] for key in ("shared_field_matches", "matched_occurrences_including_source_type", "api_only_occurrences", "reference_only_occurrences")} for sensor, info in audit["sources"].items()},
            "notice": "Real detections, unreviewed. Counts retain repeated observations; proposed filtering is unapproved. Input time windows are complete, observation coverage is unknown. No harmonization, baseline or anomaly inference.",
            "records": preview_rows(selected_rows),
        }
        write_json(staging / "pantanal-solar.json", preview)
        with (staging / "regional-detections.jsonl").open("w") as stream:
            for row in selected_rows:
                stream.write(json.dumps(row, allow_nan=False) + "\n")
        shutil.move(str(base / "raw"), staging / "raw")
        shutil.move(str(base / "audit.json"), staging / "base-audit.json")
        shutil.rmtree(base)
        shutil.rmtree(staging / "normalized")
        output.mkdir()
        try:
            for item in staging.iterdir():
                item.rename(output / item.name)
        except OSError:
            shutil.rmtree(output)
            raise
        return preview
    finally:
        shutil.rmtree(staging)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--evidence", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    try:
        preview = prepare_preview(**vars(args), map_key=os.environ.get("FIRMS_MAP_KEY"))
    except (DownloadError, NormalizationError) as error:
        parser.exit(1, f"Error: {error}\n")
    except (OSError, ValueError, KeyError):
        parser.exit(1, "Error: cannot validate or save the experimental preview.\n")
    # Explicit numeric/statistical projection only; no raw rows or secret values.
    print("SOLAR_PREVIEW_HEADER=" + json.dumps({key: value for key, value in preview.items() if key != "records"}, separators=(",", ":")))
    for row in preview["records"]:
        print("SOLAR_PREVIEW_DAY=" + json.dumps(row, separators=(",", ":")))


if __name__ == "__main__":
    main()
