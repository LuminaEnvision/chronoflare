"""Offline CSV diagnostics and provisional polygon partitioning; no scientific approval."""

from __future__ import annotations

import argparse
from collections import Counter
from datetime import datetime, timezone
import json
import math
from pathlib import Path
import shutil
import sys
import tempfile

from shapely.errors import GEOSException
from shapely.geometry import Point, shape
from shapely.validation import explain_validity

from normalize_detections import NormalizationError, file_hash, normalize_csv

VERSION = "1.0.0"


def load_polygon(path: Path):
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
        crs = value.get("crs")
        if crs is not None and crs != {"type": "name", "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"}}:
            raise NormalizationError("AOI must use longitude/latitude CRS84; reproject explicitly before intake.")
        if value.get("type") == "FeatureCollection":
            if len(value.get("features", [])) != 1:
                raise NormalizationError("AOI must contain exactly one polygon feature.")
            value = value["features"][0]
        if value.get("type") == "Feature":
            value = value["geometry"]
        if value.get("type") not in {"Polygon", "MultiPolygon"}:
            raise NormalizationError("AOI must be a Polygon or MultiPolygon.")
        polygons = value["coordinates"] if value["type"] == "MultiPolygon" else [value["coordinates"]]
        for rings in polygons:
            for ring in rings:
                if len(ring) < 4 or ring[0] != ring[-1]:
                    raise NormalizationError("AOI rings must be explicitly closed with at least four positions.")
        geometry = shape(value)
    except (ValueError, TypeError, KeyError, AttributeError, GEOSException):
        raise NormalizationError("AOI must be valid GeoJSON polygon geometry.") from None
    if geometry.is_empty or not geometry.is_valid or geometry.has_z:
        raise NormalizationError(f"AOI must be valid, nonempty and two-dimensional: {explain_validity(geometry)}")
    polygons = list(geometry.geoms) if geometry.geom_type == "MultiPolygon" else [geometry]
    for polygon in polygons:
        for ring in [polygon.exterior, *polygon.interiors]:
            coordinates = list(ring.coords)
            for lon, lat in coordinates:
                if not math.isfinite(lon) or not math.isfinite(lat) or not -180 <= lon <= 180 or not -90 <= lat <= 90:
                    raise NormalizationError("AOI coordinates must be finite longitude/latitude degrees.")
            if any(abs(a[0] - b[0]) > 180 for a, b in zip(coordinates, coordinates[1:])):
                raise NormalizationError("Antimeridian-crossing rings require explicit preprocessing.")
    return geometry


class Diagnostics:
    def __init__(self):
        self.count = 0
        self.platforms, self.confidence, self.types = Counter(), Counter(), Counter()
        self.days = {}
        self.frp_min = self.frp_max = None

    def add(self, row):
        self.count += 1
        self.platforms[row["satellite"]] += 1
        self.confidence[row["confidence_raw"].strip()] += 1
        self.types[row["source_type"] or "missing"] += 1
        frp = row["frp_mw"]
        self.frp_min = frp if self.frp_min is None else min(self.frp_min, frp)
        self.frp_max = frp if self.frp_max is None else max(self.frp_max, frp)
        key = (row["acquired_at_utc"][:10], row["satellite"])
        day = self.days.setdefault(key, {"record_count": 0, "raw_frp_sum_mw": 0.0})
        day["record_count"] += 1
        day["raw_frp_sum_mw"] += frp
        if not math.isfinite(day["raw_frp_sum_mw"]):
            raise NormalizationError("Diagnostic FRP sum overflowed.")

    def report(self):
        return {"record_count": self.count, "platform_counts": dict(sorted(self.platforms.items())),
                "confidence_raw_counts": dict(sorted(self.confidence.items())), "source_type_counts": dict(sorted(self.types.items())),
                "raw_frp_range_mw": {"min": self.frp_min, "max": self.frp_max},
                "daily_by_platform_utc": [{"date": day, "satellite": platform, **counts} for (day, platform), counts in sorted(self.days.items())]}


def diagnose(*, input_path: Path, source: str, aoi: Path, aoi_reference: str, output: Path):
    if not aoi_reference.strip():
        raise NormalizationError("Provide an AOI reference, explicitly provisional if unconfirmed.")
    project = Path(__file__).resolve().parents[2]
    output = output.resolve()
    if any(output.is_relative_to(project / name) for name in ("app", "dist")) or output.exists():
        raise NormalizationError("Choose a new output directory outside app/ and dist/.")
    aoi_digest = file_hash(aoi)
    polygon = load_polygon(aoi)
    output.parent.mkdir(parents=True, exist_ok=True)
    staging = Path(tempfile.mkdtemp(prefix=".diagnose-", dir=output.parent))
    try:
        intake = normalize_csv(input_path=input_path, source=source, output=staging / "normalized")
        summaries = {name: Diagnostics() for name in ("all", "inside", "boundary", "outside")}
        from contextlib import ExitStack
        with ExitStack() as stack:
            outputs = {name: stack.enter_context((staging / f"{name}.jsonl").open("w", encoding="utf-8")) for name in ("inside", "boundary", "outside")}
            with (staging / "normalized/detections.jsonl").open(encoding="utf-8") as stream:
                for line in stream:
                    row = json.loads(line)
                    point = Point(row["longitude"], row["latitude"])
                    category = "inside" if polygon.contains(point) else "boundary" if polygon.covers(point) else "outside"
                    outputs[category].write(line)
                    summaries["all"].add(row)
                    summaries[category].add(row)
        if file_hash(aoi) != aoi_digest:
            raise NormalizationError("AOI changed during diagnostics.")
        # Preserve exactly the reviewed geometry bytes, not a repaired/reprojected shape.
        shutil.copyfile(aoi, staging / "aoi.geojson")
        if file_hash(staging / "aoi.geojson") != aoi_digest:
            raise NormalizationError("AOI changed while copying.")
        report = {"schema_version": "spatial-diagnostic/1.0.0", "diagnostic_version": VERSION,
                  "generated_at_utc": datetime.now(timezone.utc).isoformat(), "source_dataset": source,
                  "input_sha256": intake["input_sha256"], "normalization_version": intake["normalization_version"],
                  "aoi_sha256": aoi_digest, "aoi_reference": aoi_reference, "aoi_status": "unconfirmed",
                  "scientific_status": "unreviewed", "coverage_status": "unknown",
                  "boundary_rule": "Exact planar longitude/latitude point classification; boundary records are separate, with no tolerance or automatic inclusion.",
                  "notice": "UTC detection diagnostics only. Counts are not fire events. FRP sums are unfiltered record sums per platform, not approved daily activity. No zero-day filling, local-solar-date conversion, quality filtering, deduplication, sensor combination or frontend export.",
                  "groups": {name: summary.report() for name, summary in summaries.items()},
                  "partition_sha256": {name: file_hash(staging / f"{name}.jsonl") for name in outputs}}
        (staging / "diagnostic-report.json").write_text(json.dumps(report, indent=2, allow_nan=False) + "\n")
        output.mkdir()
        try:
            for item in staging.iterdir():
                item.rename(output / item.name)
        except OSError:
            shutil.rmtree(output)
            raise
        return report
    finally:
        shutil.rmtree(staging)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", dest="input_path", type=Path, required=True)
    parser.add_argument("--source", required=True)
    parser.add_argument("--aoi", type=Path, required=True)
    parser.add_argument("--aoi-reference", required=True)
    parser.add_argument("--output", type=Path, required=True)
    try:
        report = diagnose(**vars(parser.parse_args(argv)))
    except NormalizationError as error:
        print(f"Error: {error}", file=sys.stderr)
        return 1
    except OSError:
        print("Error: cannot read input/AOI or save output; check paths and permissions.", file=sys.stderr)
        return 1
    print(json.dumps({name: group["record_count"] for name, group in report["groups"].items()}))
    print("Diagnostic only: AOI unconfirmed, science unreviewed, coverage unknown.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
