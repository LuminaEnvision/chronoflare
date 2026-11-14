"""Add an offline point-centre subset using the pinned official IBGE 2025 boundary."""

import argparse
from io import BytesIO
import json
import math
import re
from datetime import date
from pathlib import Path
import shutil
import sys
import tempfile
import zipfile

import shapefile
from pyproj import CRS, Transformer
from shapely import contains_xy, intersects_xy, prepare, transform
from shapely.geometry import shape, mapping

from export_detection_review import write_json, SCHEMA
from normalize_detections import NormalizationError, file_hash

ARCHIVE_SHA256 = "247b15c427070805044ebe02012f15552850d535fbfecaddb359875cdda1ea8f"
ARCHIVE_URL = "https://geoftp.ibge.gov.br/informacoes_ambientais/estudos_ambientais/biomas/vetores/2025_Biomas-e-Sistema-Costeiro-Marinho-do-Brasil-1-250000_shp.zip"
LAYER = "lml_bioma_e250k_v20250911_A"


def official_boundary(archive):
    if file_hash(archive) != ARCHIVE_SHA256:
        raise NormalizationError(
            "IBGE archive does not match the pinned 2025 source hash."
        )
    with zipfile.ZipFile(archive) as z:
        if sum(item.file_size for item in z.infolist()) > 100_000_000:
            raise NormalizationError("IBGE archive exceeds the supported size.")
        if CRS.from_wkt(z.read(LAYER + ".prj").decode()).to_epsg() != 4674:
            raise NormalizationError("Expected native SIRGAS 2000 EPSG:4674.")
        reader = shapefile.Reader(
            shp=BytesIO(z.read(LAYER + ".shp")),
            shx=BytesIO(z.read(LAYER + ".shx")),
            dbf=BytesIO(z.read(LAYER + ".dbf")),
            encoding="utf-8",
        )
        matches = [
            item
            for item in reader.iterShapeRecords()
            if item.record.as_dict().get("CD_BIOMA") == "6"
            and item.record.as_dict().get("NM_BIOMA") == "Pantanal"
        ]
        if len(matches) != 1:
            raise NormalizationError("Expected exactly one official Pantanal feature.")
        native = shape(matches[0].shape.__geo_interface__)
    if (
        native.is_empty
        or not native.is_valid
        or native.geom_type not in ("Polygon", "MultiPolygon")
    ):
        raise NormalizationError(
            "Official boundary must be valid without geometry repair."
        )
    operation = Transformer.from_crs(4674, 4326, always_xy=True, allow_ballpark=False)
    polygon = transform(native, operation.transform, interleaved=False)
    if not polygon.is_valid:
        raise NormalizationError(
            "Transformed geometry is invalid; no repair was applied."
        )
    provenance = {
        "institution": "IBGE",
        "edition": "2025",
        "archive_url": ARCHIVE_URL,
        "archive_sha256": ARCHIVE_SHA256,
        "source_layer": LAYER,
        "feature_selection": "CD_BIOMA=6; NM_BIOMA=Pantanal",
        "source_crs": "EPSG:4674",
        "output_crs": "OGC:CRS84",
        "transformation": operation.description,
        "transformation_accuracy_metres": operation.accuracy,
        "geometry_policy": "No repair, simplification, snapping or generated coordinates.",
    }
    return polygon, provenance


def partition(points, polygon):
    """Retain all matching original records, including coincident/duplicate detections."""
    if not points:
        return [], 0
    x, y = [point[1] for point in points], [point[2] for point in points]
    inside = contains_xy(polygon, x, y)
    covered = intersects_xy(polygon, x, y)
    return [point for point, keep in zip(points, covered) if keep], int(
        (covered & ~inside).sum()
    )


def prepare_region(*, national: Path, archive: Path, output: Path):
    national = national.resolve()
    output = output.resolve()
    project = Path(__file__).resolve().parents[2]
    if (
        output.exists()
        or output.is_relative_to(project / "app")
        or output.is_relative_to(project / "dist")
        or output.is_relative_to(national)
    ):
        raise NormalizationError(
            "Choose a new offline output directory outside app/, dist/ and the source package."
        )
    manifest_path = national / "manifest.json"
    manifest_digest = file_hash(manifest_path)
    manifest = json.loads(manifest_path.read_text())
    if (
        manifest.get("schema_version") != SCHEMA
        or manifest.get("scope") != "brazil_download"
        or manifest.get("status") != "raw_unreviewed"
        or "pantanal" in manifest
    ):
        raise NormalizationError("Expected an unreviewed national-only package.")
    polygon, provenance = official_boundary(archive)
    prepare(polygon)
    output.parent.mkdir(parents=True, exist_ok=True)
    staging = Path(tempfile.mkdtemp(prefix=".pantanal-", dir=output.parent))
    try:
        sources = {}
        for source in ("modis", "viirs"):
            info = manifest["sources"][source]
            entries, count, boundary_count, seen = [], 0, 0, set()
            for entry in info["days"]:
                day = entry["date"]
                if (
                    not isinstance(day, str)
                    or not re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}", day)
                    or date.fromisoformat(day).isoformat() != day
                ):
                    raise NormalizationError("National day must be an ISO date.")
                expected_path = f"{source}/{entry['date']}.json"
                if entry["path"] != expected_path:
                    raise NormalizationError(
                        "National day asset has an unexpected path."
                    )
                path = (national / expected_path).resolve()
                if (
                    not path.is_relative_to(national)
                    or path.stat().st_size != entry["bytes"]
                    or file_hash(path) != entry["sha256"]
                ):
                    raise NormalizationError("National day asset integrity mismatch.")
                data = json.loads(path.read_text())
                points = data["points"]
                if (
                    data["source"] != source
                    or data["date"] != entry["date"]
                    or data["schema_version"] != SCHEMA
                    or len(points) != entry["count"]
                ):
                    raise NormalizationError("National day metadata/count mismatch.")
                for point in points:
                    if (
                        not isinstance(point, list)
                        or len(point) != 8
                        or type(point[0]) is not int
                        or point[0] <= 0
                        or any(
                            type(point[i]) not in (int, float)
                            or not math.isfinite(point[i])
                            for i in (1, 2)
                        )
                        or not -180 <= point[1] <= 180
                        or not -90 <= point[2] <= 90
                    ):
                        raise NormalizationError(
                            "Invalid national record reference or coordinates."
                        )
                    if point[0] in seen:
                        raise NormalizationError(
                            "Repeated original record reference in national package."
                        )
                    seen.add(point[0])
                selected, on_boundary = partition(points, polygon)
                boundary_count += on_boundary
                count += len(selected)
                regional = write_json(
                    staging / "pantanal" / expected_path, {**data, "points": selected}
                )
                regional.update(
                    path=f"pantanal/{expected_path}",
                    date=entry["date"],
                    count=len(selected),
                )
                entries.append(regional)
                # Preserve the verified national bytes unchanged.
                target = staging / expected_path
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(path, target)
                if file_hash(target) != entry["sha256"]:
                    raise NormalizationError("National file changed while copying.")
            if len(seen) != info["record_count"]:
                raise NormalizationError("National source total is inconsistent.")
            sources[source] = {
                **info,
                "record_count": count,
                "days": entries,
                "boundary_record_count": boundary_count,
            }
        boundary = write_json(
            staging / "pantanal/boundary.json",
            {
                "type": "Feature",
                "properties": {"source": "IBGE", "edition": "2025", "name": "Pantanal"},
                "geometry": mapping(polygon),
            },
        )
        boundary["path"] = "pantanal/boundary.json"
        manifest["pantanal"] = {
            "name": "Pantanal",
            "status": "raw_unreviewed",
            "source_status": "verified_official_reference",
            "membership_rule": "Point centres inside or exactly on the IBGE 2025 boundary; no buffer or tolerance.",
            "boundary": boundary,
            "provenance": provenance,
            "sources": sources,
            "notice": "Spatial reference filter only. This does not approve scientific coverage, zeros, calibration or fire-event attribution.",
        }
        if file_hash(manifest_path) != manifest_digest:
            raise NormalizationError("Source manifest changed during processing.")
        manifest["notice"] = manifest["notice"].replace(
            "no country/Pantanal clipping or AOI boundary is applied.",
            "the national view is not independently country-clipped.",
        )
        manifest[
            "notice"
        ] += " Optional Pantanal subset uses the recorded official IBGE 2025 reference; scientific status remains unreviewed."
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
    for name in ("national", "archive", "output"):
        parser.add_argument("--" + name, type=Path, required=True)
    try:
        manifest = prepare_region(**vars(parser.parse_args()))
    except (
        NormalizationError,
        ValueError,
        KeyError,
        TypeError,
        zipfile.BadZipFile,
    ) as error:
        print(f"Error: invalid regional input: {error}", file=sys.stderr)
        return 1
    except OSError:
        print("Error: cannot read source files or save output.", file=sys.stderr)
        return 1
    print(
        json.dumps(
            {
                key: info["record_count"]
                for key, info in manifest["pantanal"]["sources"].items()
            }
        )
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
