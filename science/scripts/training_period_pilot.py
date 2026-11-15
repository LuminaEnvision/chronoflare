"""Bounded 2019 acquisition and same-rule 2020 replay; no calibration or approval."""
from collections import Counter, defaultdict
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_EVEN, ROUND_HALF_UP
import argparse
import json
import os
from pathlib import Path
import shutil
import sys
import tempfile

from shapely import intersects_xy

from coverage_evidence import day_evidence
from firms_download import DownloadError, download_area
from firms_pilot import BBOX, SOURCES, cached_downloader, load_pinned_boundary
from indicator_quality import RULE_VERSION, classify_quality
from normalize_detections import NormalizationError, canonical_decimal, file_hash, normalize_csv
from solar_time import local_solar_date, solar_day_utc_window


def request_plan(year):
    if type(year) is not int or year not in (2019, 2020):
        raise ValueError("This bounded pilot supports 2019 acquisition or 2020 replay only")
    return [{"id": f"{sensor}-{day}", "source": source, "start": f"{year}-08-{day:02d}", "days": 1 if day == 16 else 5}
            for sensor, source in SOURCES.items() for day in (1, 6, 11, 16)]


def duplicate_diagnostics(rows):
    results = {}
    for name, rounding in (("half_even", ROUND_HALF_EVEN), ("half_up", ROUND_HALF_UP)):
        groups = defaultdict(list)
        for row in rows:
            raw = {key.strip().lower(): value for key, value in row["raw_record"].items()}
            key = (row["sensor"], row["satellite"], row["acquired_at_utc"],
                   canonical_decimal(Decimal(raw["latitude"]).quantize(Decimal("0.00001"), rounding=rounding)),
                   canonical_decimal(Decimal(raw["longitude"]).quantize(Decimal("0.00001"), rounding=rounding)))
            groups[key].append(row)
        collisions = [group for group in groups.values() if len(group) > 1]
        results[name] = {"collision_groups": len(collisions), "involved_records": sum(len(group) for group in collisions),
                         "extra_occurrences": sum(len(group) - 1 for group in collisions),
                         "conflicting_frp_groups": sum(len({row["frp_mw"] for row in group}) > 1 for group in collisions),
                         "conflicting_quality_groups": sum(len({row["quality_pass"] for row in group}) > 1 for group in collisions)}
    return {"status": "diagnostic_only_no_winner_selected", "deduplication_applied": False, "rounding_scenarios": results}


def turn_inventory(rows, year):
    grouped = defaultdict(list)
    for row in rows:
        grouped[(row["satellite"], row["local_solar_date"], row["day_night"])].append(row)
    cells = []
    for index in range(15):
        day = (date(year, 8, 1) + timedelta(days=index)).isoformat()
        start, end = solar_day_utc_window(day)
        for platform in ("Terra", "Aqua", "S-NPP"):
            evidence = day_evidence(platform, day)
            for turn in ("D", "N"):
                selected = [row for row in grouped[(platform, day, turn)] if row["quality_pass"]]
                value = sum((Decimal(str(row["frp_mw"])) for row in selected), Decimal(0))
                cells.append({"solar_date": day, "platform": platform, "day_night": turn,
                              "period_start_utc": start.isoformat(), "period_end_utc_exclusive": end.isoformat(),
                              "input_window_complete": True, "raw_record_count": len(grouped[(platform, day, turn)]),
                              "quality_pass_count_before_dedup": len(selected) if selected else None,
                              "frp_audit_sum_mw_before_dedup": float(value) if selected else None,
                              "coverage_status": "unknown", "coverage_fraction": None, "overpass_count": None,
                              "operational_state": evidence["operational_state"]})
    return cells


def audit_year(*, year, output, downloader, map_key, reference, expected_provenance=None):
    """Build one year independently; source date windows never mix across splits."""
    polygon, manifest = load_pinned_boundary(reference)
    output.mkdir(parents=True)
    rows, requests = [], []
    for request in request_plan(year):
        raw = output / "raw" / request["id"]
        metadata = downloader(source=request["source"], bbox=BBOX, start=request["start"], days=request["days"], output=raw, map_key=map_key)
        if expected_provenance is not None:
            expected = next((entry for entry in expected_provenance if entry["source"] == request["source"] and entry["requested_start_utc"] == request["start"]), None)
            if expected is None or metadata["sha256"] != expected["sha256"]:
                raise NormalizationError("Replay source hash differs from the frozen 2020 calendar provenance.")
        normalized = output / "normalized" / request["id"]
        normalization = normalize_csv(input_path=raw / "detections.csv", source=request["source"], output=normalized, provenance=raw / "provenance.json")
        records = [json.loads(line) for line in (normalized / "detections.jsonl").read_text().splitlines()]
        included = intersects_xy(polygon, [row["longitude"] for row in records], [row["latitude"] for row in records]) if records else []
        regional = solar_selected = 0
        for row, inside in zip(records, included):
            if not inside:
                continue
            regional += 1
            day = local_solar_date(row["acquired_at_utc"])
            if not f"{year}-08-01" <= day <= f"{year}-08-15":
                continue
            solar_selected += 1
            raw_fields = {key.strip().lower(): value for key, value in row["raw_record"].items()}
            quality = classify_quality(raw_fields, request["source"])
            rows.append({**row, **quality, "request_id": request["id"], "local_solar_date": day})
        requests.append({**request, "download": metadata, "normalization": normalization, "bbox_region_count": regional, "selected_solar_record_count": solar_selected})
    cells = turn_inventory(rows, year)
    populations = {}
    for platform in ("Terra", "Aqua", "S-NPP"):
        subset = [row for row in rows if row["satellite"] == platform]
        passed = [row for row in subset if row["quality_pass"]]
        populations[platform] = {"raw_records": len(subset), "quality_pass_before_dedup": len(passed),
                                 "quality_fail": len(subset) - len(passed),
                                 "collection_values": sorted({row["collection"] for row in subset if row["collection"] is not None}),
                                 "missing_collection_records": sum(row["collection"] is None for row in subset),
                                 "rejection_reason_counts": dict(Counter(reason for row in subset for reason in row["quality_reasons"])),
                                 "missing_turn_records": sum(row["day_night"] is None for row in subset)}
    overlap = {}
    for platform in ("Terra", "Aqua"):
        left = {(row["solar_date"], row["day_night"]) for row in cells if row["platform"] == platform and row["quality_pass_count_before_dedup"] is not None}
        right = {(row["solar_date"], row["day_night"]) for row in cells if row["platform"] == "S-NPP" and row["quality_pass_count_before_dedup"] is not None}
        overlap[platform] = {"potential_same_turn_positive_groups_before_dedup": len(left & right), "predictor_only_positive_groups": len(left - right), "reference_only_positive_groups": len(right - left),
                             "status": "inventory_only_not_final_validation_pairs"}
    report = {"schema_version": "training-period-audit/1.0.0", "year": year, "solar_dates_inclusive": [f"{year}-08-01", f"{year}-08-15"],
              "source_utc_dates_inclusive": [f"{year}-08-01", f"{year}-08-16"], "request_count": 8,
              "scope": "Pinned IBGE 2025 Pantanal reference; point centres inside or on boundary, no buffer",
              "reference_manifest_sha256": file_hash(reference / "manifest.json"), "boundary_sha256": manifest["pantanal"]["boundary"]["sha256"],
              "quality_rule_version": RULE_VERSION, "status": "quality_and_turn_inventory_only", "deduplication_applied": False,
              "calibration_performed": False, "validation_performed": False, "harmonization_approved": False,
              "platforms": populations, "duplicate_key_audit": duplicate_diagnostics(rows), "potential_turn_overlap": overlap,
              "requests": requests, "cells": cells,
              "notice": "Pre-dedup audit statistics only; missing positives stay null. Input completeness is not clear-sky coverage. No coefficients, weights, approved indicator, anomaly or cross-year trend is produced."}
    (output / "audit.json").write_text(json.dumps(report, indent=2, allow_nan=False) + "\n")
    with (output / "regional-records.jsonl").open("w") as stream:
        for row in rows:
            stream.write(json.dumps(row, allow_nan=False) + "\n")
    shutil.rmtree(output / "normalized")
    return report


def run_pilot(*, output, reference_evidence, map_key, downloader=download_area):
    project = Path(__file__).resolve().parents[2]
    output = output.resolve()
    if output.exists() or any(output.is_relative_to(project / name) for name in ("app", "dist")):
        raise ValueError("Choose a new offline destination outside app/ and dist/")
    if not map_key:
        raise DownloadError("Set FIRMS_MAP_KEY for the eight bounded 2019 requests.")
    if not (reference_evidence / "raw").is_dir():
        reference_evidence = reference_evidence / "2020"
    frozen = json.loads((project / "app/public/data/experimental/v1/pantanal-solar.json").read_text())
    reference = project / "app/public/data/detection-review/v1"
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="training-period-", dir=output.parent) as temporary:
        staging = Path(temporary)
        # Verify the held-out replay evidence before spending the new request budget.
        baseline = audit_year(year=2020, output=staging / "2020", downloader=cached_downloader(reference_evidence), map_key="offline-replay", reference=reference, expected_provenance=frozen["provenance"])
        training = audit_year(year=2019, output=staging / "2019", downloader=downloader, map_key=map_key, reference=reference)
        comparison = {"schema_version": "training-period-readiness/1.0.0", "quality_rule_version": RULE_VERSION,
                      "reference_boundary_sha256": training["boundary_sha256"], "years": [2019, 2020],
                      "new_nasa_requests": 8, "replayed_requests": 8,
                      "forward_roles": {"2019": "training_period_candidate", "2020": "held_out_period_candidate"},
                      "distinct_solar_dates_per_year": 15, "seasons": ["dry"],
                      "same_quality_rule": training["quality_rule_version"] == baseline["quality_rule_version"],
                      "same_boundary": training["boundary_sha256"] == baseline["boundary_sha256"],
                      "deduplication_applied": False, "model_fit_performed": False, "validation_performed": False,
                      "harmonization_approved": False, "remaining": ["final duplicate/rounding policy", "missing-turn estimate policy", "delivery 4 thresholds and evaluation rules", "multi-year and wet-season inputs"],
                      "notice": "Side-by-side acquisition/quality readiness only. Do not interpret pre-dedup counts or FRP audit sums as calibrated inter-year fire trends."}
        (staging / "readiness.json").write_text(json.dumps(comparison, indent=2) + "\n")
        output.mkdir()
        try:
            shutil.copytree(staging, output, dirs_exist_ok=True)
        except OSError:
            shutil.rmtree(output)
            raise
        return comparison


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--reference-evidence", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    try:
        result = run_pilot(**vars(args), map_key=os.environ.get("FIRMS_MAP_KEY"))
    except (DownloadError, NormalizationError, OSError, ValueError, KeyError):
        parser.exit(1, "Error: bounded training-period audit could not download, verify or save its inputs.\n")
    print(f"Prepared {len(result['years'])} years with the same SP quality rule; eight 2019 requests and eight offline 2020 replays. No model fit or approval.")


if __name__ == "__main__":
    main()
