"""Freeze a bounded multi-year, two-season FIRMS plan before requesting data."""
import argparse
from datetime import date, timedelta
import hashlib
import json
from pathlib import Path

YEARS = (2017, 2018, 2019, 2020, 2021, 2013, 2014, 2015)
BBOX = "-60,-23,-54,-15"
SOURCES = ("MODIS_SP", "VIIRS_SNPP_SP")
VERSION = "pantanal-multiyear-acquisition/1.1.0"


def fingerprint(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()).hexdigest()


def build_plan(*, legacy=False):
    blocks, requests = [], []
    for year in YEARS:
        for season, month, day in (("dry", 8, 1), ("wet", 2, 1)):
            start = date(year, month, day)
            end = start + timedelta(days=62)
            block_id = f"{year}-{season}"
            blocks.append({"id": block_id, "solar_start": start.isoformat(), "solar_end": end.isoformat(),
                           "selection": "Fixed 63-day window, chosen before model fitting; not a full-year sample"})
            # Fixed solar midnight is 03:46:36 UTC: include the following UTC date.
            for source in SOURCES:
                cursor = start
                while cursor <= end + timedelta(days=1):
                    days = min(5, (end + timedelta(days=1) - cursor).days + 1)
                    requests.append({"id": f"{source.lower()}-{cursor.isoformat()}", "block_id": block_id,
                                     "source": source, "bbox": BBOX, "start": cursor.isoformat(), "days": days})
                    cursor += timedelta(days=days)
    if not legacy:
        extra = [("2012-complete", "2012-01-20", "2012-12-31")]
        for year in (2013, 2014, 2015):
            extra.extend((f"{year}-{name}", f"{year}-{first}", f"{year}-{last}") for name, first, last in
                         (("january-gap", "01-01", "01-31"), ("middle-gap", "04-05", "07-31"), ("late-gap", "10-03", "12-31")))
        for year in (2022, 2023, 2024):
            for name, month in (("dry", 8), ("wet", 2)):
                first = date(year, month, 1)
                extra.append((f"{year}-{name}", first.isoformat(), (first + timedelta(days=62)).isoformat()))
        for block_id, first, last in extra:
            blocks.append({"id":block_id,"solar_start":first,"solar_end":last,
                           "selection":"Versioned support expansion before any empirical model scoring; fixed full backward years and consecutive forward years"})
            for source in SOURCES:
                cursor=date.fromisoformat(first);end=date.fromisoformat(last)+timedelta(days=1)
                while cursor<=end:
                    days=min(5,(end-cursor).days+1)
                    requests.append({"id":f"{source.lower()}-{cursor.isoformat()}-{block_id}","block_id":block_id,"source":source,"bbox":BBOX,"start":cursor.isoformat(),"days":days})
                    cursor+=timedelta(days=days)
    return {"schema_version": "pantanal-multiyear-acquisition/1.0.0" if legacy else VERSION, "region_id": "pantanal_ibge_2025_reference",
            "solar_offset_seconds": -13596, "sources": list(SOURCES), "bbox": BBOX,
            "selection_policy": "Fixed windows, never selected or extended using held-out model scores",
            "blocks": blocks, "requests": requests, "request_count": len(requests),
            "solar_date_count": sum((date.fromisoformat(b["solar_end"])-date.fromisoformat(b["solar_start"])).days+1 for b in blocks),
            "scientific_status": "acquisition_plan_not_evidence_of_positive_pairs_or_coverage",
            "harmonization_approved": False}


def load_plan(path, *, allow_legacy=False):
    plan = json.loads(Path(path).read_text())
    if plan != build_plan() and not (allow_legacy and plan == build_plan(legacy=True)):
        raise ValueError("Acquisition plan differs from the frozen version; review a new version first")
    return plan


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    with args.output.open("x") as stream:
        stream.write(json.dumps(build_plan(), indent=2) + "\n")
