"""Export unreviewed Brazil-download map assets directly from original FIRMS CSVs."""

import argparse
from datetime import date, timedelta
import json
import re
from pathlib import Path
import shutil
import sys
import tempfile

from normalize_detections import NormalizationError, file_hash, normalize_csv

SCHEMA = "detection-review/1.0.0"


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, separators=(",", ":"), allow_nan=False) + "\n",
        encoding="utf-8",
    )
    return {
        "path": str(path.name),
        "sha256": file_hash(path),
        "bytes": path.stat().st_size,
    }


def export_review(
    *,
    modis: Path,
    viirs: Path,
    start: str,
    end: str,
    modis_request: str,
    viirs_request: str,
    output: Path,
):
    try:
        first, last = date.fromisoformat(start), date.fromisoformat(end)
        if (
            first.isoformat() != start
            or last.isoformat() != end
            or first > last
            or (last - first).days > 366
        ):
            raise ValueError()
    except ValueError:
        raise NormalizationError(
            "Use an inclusive ISO date window of at most 367 days."
        ) from None
    if not all(
        re.fullmatch(r"[0-9]{1,32}", value) for value in (modis_request, viirs_request)
    ):
        raise NormalizationError("Request IDs must contain digits.")
    project = Path(__file__).resolve().parents[2]
    output = output.resolve()
    if (
        output.exists()
        or (
            output.is_relative_to(project / "app")
            and output != project / "app/public/data/detection-review/v1"
        )
        or output.is_relative_to(project / "dist")
    ):
        raise NormalizationError(
            "Choose a new local directory or the dedicated detection-review/v1 asset directory."
        )
    output.parent.mkdir(parents=True, exist_ok=True)
    staging = Path(tempfile.mkdtemp(prefix=".review-", dir=output.parent))
    try:
        days = [
            (first + timedelta(days=i)).isoformat()
            for i in range((last - first).days + 1)
        ]
        sources = {}
        for key, input_path, source, request in [
            ("modis", modis, "MODIS_SP", modis_request),
            ("viirs", viirs, "VIIRS_SNPP_SP", viirs_request),
        ]:
            buckets = {day: [] for day in days}
            # Full normalization stays outside public assets, even during export.
            with tempfile.TemporaryDirectory(prefix="firms-review-input-") as temp:
                normalized = Path(temp) / "normalized"
                report = normalize_csv(
                    input_path=input_path, source=source, output=normalized
                )
                with (normalized / "detections.jsonl").open(encoding="utf-8") as stream:
                    for line in stream:
                        row = json.loads(line)
                        day = row["acquired_at_utc"][:10]
                        if day not in buckets:
                            raise NormalizationError(
                                "An input record is outside the declared UTC request window."
                            )
                        buckets[day].append(
                            [
                                row["source_record"],
                                row["longitude"],
                                row["latitude"],
                                row["acquired_at_utc"][11:],
                                row["satellite"],
                                row["frp_mw"],
                                row["confidence_raw"],
                                row["source_type"],
                            ]
                        )
            entries = []
            for day, points in buckets.items():
                item = write_json(
                    staging / key / f"{day}.json",
                    {
                        "schema_version": SCHEMA,
                        "source": key,
                        "date": day,
                        "points": points,
                    },
                )
                item.update(path=f"{key}/{day}.json", date=day, count=len(points))
                entries.append(item)
            sources[key] = {
                "source_dataset": source,
                "request_id": request,
                "input_file": report["input_file"],
                "input_sha256": report["input_sha256"],
                "normalization_version": report["normalization_version"],
                "collection_values": report["collections"],
                "record_count": report["record_count"],
                "days": entries,
            }
        manifest = {
            "schema_version": SCHEMA,
            "status": "raw_unreviewed",
            "aoi_status": "not_applied",
            "coverage_status": "unknown",
            "start_date": start,
            "end_date": end,
            "scope": "brazil_download",
            "declared_download_area": "Brazil",
            "sources": sources,
            "notice": "Original FIRMS detection records supplied by the project team. Technical intake only; origin is not independently authenticated. Brazil request area is declared by the supplier; no country/Pantanal clipping or AOI boundary is applied. No quality filtering, deduplication, coverage inference, event counting or scientific approval. Independent of the synthetic calendar.",
        }
        write_json(staging / "manifest.json", manifest)
        output.mkdir()
        try:
            for item in staging.iterdir():
                item.rename(output / item.name)
        except OSError:
            shutil.rmtree(output)
            raise
        return manifest
    finally:
        shutil.rmtree(staging)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("modis", "viirs", "output"):
        parser.add_argument(f"--{name}", type=Path, required=True)
    for name in ("start", "end", "modis-request", "viirs-request"):
        parser.add_argument(f"--{name}", required=True)
    try:
        result = export_review(**vars(parser.parse_args()))
    except (NormalizationError, ValueError, KeyError, TypeError) as error:
        print(
            f"Error: invalid CSV or export arguments: {error}",
            file=sys.stderr,
        )
        return 1
    except OSError:
        print("Error: cannot read CSV inputs or save output.", file=sys.stderr)
        return 1
    print(
        json.dumps(
            {key: value["record_count"] for key, value in result["sources"].items()}
        )
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
