"""Rebuild source-bound observed turn aggregates offline; never fit a model."""
import argparse
import json
from pathlib import Path
import shutil
import sys
import tempfile

from firms_pilot import cached_downloader
from indicator_methods import DEDUP_VERSION, observed_turns, quality_then_deduplicate, training_sample_floor
from indicator_quality import RULE_VERSION
from normalize_detections import NormalizationError, file_hash
from training_period_pilot import audit_year
from validation_preflight import TurnObservation, experiment_from_protocol, pair_observations


def build_observations(*, evidence, output):
    project = Path(__file__).resolve().parents[2]
    output = output.resolve()
    if output.exists() or any(output.is_relative_to(project / name) for name in ("app", "dist")):
        raise ValueError("Choose a new offline output directory")
    protocol = json.loads((project / "science/configs/indicator_protocol.review.json").read_text())
    experiment = experiment_from_protocol(protocol, "forward")
    preview = json.loads((project / "app/public/data/experimental/v1/pantanal-solar.json").read_text())
    canonical = json.loads((project / "docs/training-period-audit/2019-august-summary.json").read_text())
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="indicator-observed-", dir=output.parent) as temporary:
        staging = Path(temporary)
        reports, observations = {}, []
        for year in (2019, 2020):
            verified = staging / f"verified-{year}"
            expected = preview["provenance"] if year == 2020 else [entry["download"] for entry in canonical["requests"]]
            audit_year(year=year, output=verified, downloader=cached_downloader(evidence / str(year)), map_key="offline-replay",
                       reference=project / "app/public/data/detection-review/v1", expected_provenance=expected)
            rows = [json.loads(line) for line in (verified / "regional-records.jsonl").read_text().splitlines()]
            winners, dispositions = quality_then_deduplicate(rows)
            cells = observed_turns(winners, f"{year}-08-01", f"{year}-08-15")
            year_output = staging / str(year); year_output.mkdir()
            with (year_output / "record-dispositions.jsonl").open("w") as stream:
                for row in dispositions:
                    stream.write(json.dumps(row, allow_nan=False) + "\n")
            payload = {"schema_version": "observed-indicator-turns/1.1.0", "region_id": "pantanal_ibge_2025_reference",
                       "quality_rule_version": RULE_VERSION, "dedup_rule_version": DEDUP_VERSION,
                       "raw_record_count": len(rows), "quality_pass_count": sum(row["quality_pass"] for row in dispositions),
                       "included_record_count": len(winners), "duplicate_exclusions": sum(row["indicator_exclusion"] == "duplicate_key" for row in dispositions),
                       "calibration_performed": False, "harmonization_approved": False,
                       "source_csv_sha256": [entry["sha256"] for entry in expected], "cells": cells}
            (year_output / "observations.json").write_text(json.dumps(payload, indent=2) + "\n")
            reports[str(year)] = {key: value for key, value in payload.items() if key != "cells"}
            for row in cells:
                for metric, field in (("frp_sum_mw", "observed_frp_sum_mw"), ("detection_count", "observed_detection_count")):
                    observations.append(TurnObservation(region_id=payload["region_id"], solar_date=row["solar_date"], platform=row["platform"],
                                                        day_night=row["day_night"], metric=metric, value=row[field], dataset_version="observed-indicator-turns/1.1.0",
                                                        quality_rule_version=RULE_VERSION, dedup_rule_version=DEDUP_VERSION))
            shutil.rmtree(verified)
        pairing = {}
        samples = []
        for platform in ("Terra", "Aqua"):
            result = pair_observations([row for row in observations if row.platform in (platform, "S-NPP")], platform, "S-NPP", experiment)
            pairing[platform] = result
            for turn in ("D", "N"):
                training = [row["solar_date"] for row in result["pairs"] if row["split"] == "train" and row["day_night"] == turn and row["metric"] == "frp_sum_mw"]
                testing = {row["solar_date"] for row in result["pairs"] if row["split"] == "test" and row["day_night"] == turn and row["metric"] == "frp_sum_mw"}
                samples.append({"platform": platform, "day_night": turn, "season_scope": "dry_sample_only",
                                **training_sample_floor(training, experiment), "paired_test_dates": len(testing),
                                "meets_test_sample_floor": len(testing) >= 15, "fit_allowed": False})
        summary = {"schema_version": "observed-indicator-preparation/1.1.0", "protocol_sha256": file_hash(project / "science/configs/indicator_protocol.review.json"),
                   "years": reports, "forward_pairing": pairing, "sample_floor_audit": samples,
                   "new_nasa_requests": 0, "fit_performed": False, "validation_performed": False, "harmonization_approved": False,
                   "weekly_validation_status": "not_run_no_fitted_daily_estimates_or_final_statistic_selection",
                   "notice": "Observed same-turn positive cohorts only; not complete AOI/cloud coverage. Calibration, weekly evaluation, empirical intervals and approval remain unexecuted."}
        (staging / "summary.json").write_text(json.dumps(summary, indent=2, allow_nan=False) + "\n")
        output.mkdir()
        try:
            shutil.copytree(staging, output, dirs_exist_ok=True)
        except OSError:
            shutil.rmtree(output)
            raise
        return summary


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--evidence", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    try:
        result = build_observations(**vars(args))
    except (NormalizationError, OSError, ValueError, KeyError, ArithmeticError):
        parser.exit(1, "Error: observed indicator reconstruction failed validation.\n")
    print(json.dumps({"years": result["years"], "sample_floor_audit": result["sample_floor_audit"], "new_nasa_requests": 0, "fit_performed": False}))


if __name__ == "__main__":
    main()
