"""Download one bounded FIRMS SP request without publishing scientific aggregates.

Uses only Python's standard library. The MAP_KEY never enters public assets,
command-line arguments, saved provenance, or user-facing error messages.
"""

from __future__ import annotations

import argparse
import csv
from datetime import date, datetime, timedelta, timezone
import hashlib
import io
import json
import math
import os
from pathlib import Path
import re
import shutil
import sys
import tempfile
from urllib.error import HTTPError, URLError
from urllib.request import HTTPRedirectHandler, Request, build_opener

SOURCES = ("MODIS_SP", "VIIRS_SNPP_SP", "VIIRS_NOAA20_SP", "VIIRS_NOAA21_SP")
ENDPOINT = "https://firms.modaps.eosdis.nasa.gov/api/area/csv"
MAX_BYTES = 25 * 1024 * 1024
REQUIRED_COLUMNS = {
    "latitude", "longitude", "acq_date", "acq_time", "satellite", "confidence", "frp",
}


class DownloadError(Exception):
    """A safe error containing neither provider response text nor credentials."""


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def parse_bbox(value: str) -> tuple[float, float, float, float]:
    try:
        west, south, east, north = [float(part) for part in value.split(",")]
    except ValueError:
        raise DownloadError("Use --bbox=west,south,east,north with four numbers.") from None
    if not (
        all(math.isfinite(n) for n in (west, south, east, north))
        and -180 <= west < east <= 180
        and -90 <= south < north <= 90
    ):
        raise DownloadError("Invalid bounding box; antimeridian crossings are not supported.")
    return west, south, east, north


def validate_request(source: str, bbox: str, start: str, days: int):
    if source not in SOURCES:
        raise DownloadError("Choose a supported Standard Processing (SP) source.")
    bounds = parse_bbox(bbox)
    try:
        start_date = date.fromisoformat(start)
        if start_date.isoformat() != start:
            raise ValueError()
    except ValueError:
        raise DownloadError("Use an actual start date in YYYY-MM-DD format.") from None
    if not 1 <= days <= 5:
        raise DownloadError("The Area API supports 1–5 days per request.")
    try:
        end = start_date + timedelta(days=days - 1)
    except OverflowError:
        raise DownloadError("The requested date range is invalid.") from None
    if end > datetime.now(timezone.utc).date():
        raise DownloadError("The requested range cannot include future UTC dates.")
    return bounds, start_date, end


def validate_csv(payload: bytes, bounds, start: date, end: date, *, retain_negative_frp=False) -> int:
    try:
        text = payload.decode("utf-8-sig")
        reader = csv.DictReader(io.StringIO(text), strict=True)
        if not reader.fieldnames or not REQUIRED_COLUMNS.issubset(reader.fieldnames):
            raise DownloadError("FIRMS did not return the expected detection CSV schema.")
        if len(reader.fieldnames) != len(set(reader.fieldnames)):
            raise DownloadError("FIRMS returned duplicate CSV columns.")
        count = 0
        west, south, east, north = bounds
        for row in reader:
            if None in row or any(v is None for v in row.values()):
                raise ValueError()
            lat, lon, frp = (float(row[k]) for k in ("latitude", "longitude", "frp"))
            acquired = date.fromisoformat(row["acq_date"])
            clock = row["acq_time"].zfill(4)
            checks = {
                "non_finite_value": all(math.isfinite(v) for v in (lat, lon, frp)),
                "outside_requested_bbox": south <= lat <= north and west <= lon <= east,
                "negative_frp": retain_negative_frp or frp >= 0,
                "outside_requested_dates": start <= acquired <= end,
                "invalid_clock": bool(re.fullmatch(r"\d{4}", clock)) and int(clock[:2]) <= 23 and int(clock[2:]) <= 59,
                "missing_required_value": bool(row["satellite"].strip() and row["confidence"].strip()),
            }
            failed = next((name for name, passed in checks.items() if not passed), None)
            if failed:
                raise DownloadError("FIRMS CSV failed domain validation: " + failed + ".")
            count += 1
        return count
    except (UnicodeDecodeError, ValueError, csv.Error, TypeError):
        raise DownloadError("FIRMS CSV contains malformed or out-of-request records.") from None


def download_area(
    *, source: str, bbox: str, start: str, days: int, output: Path,
    map_key: str | None, opener=None, retain_negative_frp=False,
) -> dict:
    if type(retain_negative_frp) is not bool:
        raise DownloadError("Raw FRP retention policy must be explicit boolean.")
    bounds, start_date, end_date = validate_request(source, bbox, start, days)
    if not map_key or not re.fullmatch(r"[A-Za-z0-9_-]{1,256}", map_key):
        raise DownloadError("Set FIRMS_MAP_KEY in the local environment before downloading.")
    # Raw downloads must never become frontend assets by accident.
    project = Path(__file__).resolve().parents[2]
    output = output.resolve()
    if output.is_relative_to(project / "app") or output.is_relative_to(project / "dist"):
        raise DownloadError("Raw downloads cannot be written into app/ or dist/.")
    if output.exists():
        raise DownloadError("Output already exists. Choose a new directory to preserve raw provenance.")
    normalized_bbox = ",".join(str(v) for v in bounds)
    url = f"{ENDPOINT}/{map_key}/{source}/{normalized_bbox}/{days}/{start}"
    request = Request(url, headers={"User-Agent": "ChronoFlare/0.1 (offline research client)", "Accept": "text/csv"})
    open_request = opener or build_opener(NoRedirect()).open
    try:
        with open_request(request, timeout=60) as response:
            if response.status != 200:
                raise DownloadError("FIRMS returned an unexpected HTTP status.")
            payload = response.read(MAX_BYTES + 1)
    except HTTPError as error:
        if error.code == 429:
            raise DownloadError("FIRMS rate limit reached. Wait before retrying.") from None
        raise DownloadError(f"FIRMS request failed (HTTP {error.code}). Verify key and product availability.") from None
    except (URLError, TimeoutError, OSError):
        raise DownloadError("Cannot reach FIRMS. Check connectivity and retry later.") from None
    if len(payload) > MAX_BYTES:
        raise DownloadError("Response exceeds 25 MiB. Request a smaller area or shorter period.")
    rows = validate_csv(payload, bounds, start_date, end_date, retain_negative_frp=retain_negative_frp)
    metadata = {
        "provider": "NASA FIRMS", "endpoint": ENDPOINT,
        "source": source, "processing_level": "SP", "bbox": list(bounds),
        "requested_start_utc": start, "requested_end_utc_inclusive": end_date.isoformat(),
        "retrieved_at_utc": datetime.now(timezone.utc).isoformat(),
        "sha256": hashlib.sha256(payload).hexdigest(), "bytes": len(payload),
        "row_count": rows, "raw_file": "detections.csv", "scientific_status": "unreviewed",
        "coverage_status": "unknown", "collection": None,
        "notice": "Positive detections alone do not establish observation coverage. No aggregation, calibration, or approval was performed.",
    }
    if retain_negative_frp:
        metadata["raw_frp_policy"] = "retain_finite_negative_for_quality_audit"
        metadata["negative_frp_row_count"] = sum(float(row["frp"]) < 0 for row in csv.DictReader(io.StringIO(payload.decode("utf-8-sig"))))
    output.parent.mkdir(parents=True, exist_ok=True)
    staging = Path(tempfile.mkdtemp(prefix=".firms-", dir=output.parent))
    try:
        (staging / "detections.csv").write_bytes(payload)
        (staging / "provenance.json").write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")
        # Fail rather than overwrite an existing download, including an empty directory.
        output.mkdir()
        try:
            for item in staging.iterdir():
                item.rename(output / item.name)
        except OSError:
            shutil.rmtree(output)
            raise
    finally:
        shutil.rmtree(staging)
    return metadata


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", choices=SOURCES, required=True)
    parser.add_argument("--bbox", required=True, help="Use --bbox=west,south,east,north")
    parser.add_argument("--start", required=True, help="UTC date, YYYY-MM-DD")
    parser.add_argument("--days", type=int, default=1)
    parser.add_argument("--output", type=Path, required=True, help="New local directory outside app/ and dist/")
    args = parser.parse_args(argv)
    try:
        result = download_area(**vars(args), map_key=os.environ.get("FIRMS_MAP_KEY"))
    except DownloadError as error:
        print(f"Error: {error}", file=sys.stderr)
        return 1
    except OSError:
        print("Error: cannot save download; check output directory and permissions.", file=sys.stderr)
        return 1
    print(f"Saved {result['row_count']} raw detections. Scientific review and coverage assessment are pending.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
