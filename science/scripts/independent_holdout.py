"""Plan, acquire and reconstruct dates that no model or diagnostic has examined.

The frozen multi-year plan sampled fixed windows. Every other solar date of the
registered forward test window is still unseen, so it can serve as an independent
holdout for a candidate frozen before the download. Nothing here fits or scores a
model, and nothing runs until the scientific owner records a registration.
"""
import argparse
from datetime import date, timedelta
import json
import os
from pathlib import Path

import acquisition_plan
from acquisition_plan import BBOX, SOURCES, fingerprint
from normalize_detections import file_hash

PROJECT = Path(__file__).resolve().parents[2]
PLAN = PROJECT / "science/configs/independent_holdout_plan.json"
REGISTRATION = PROJECT / "science/configs/independent_holdout.registration.json"
CANDIDATE = PROJECT / "docs/multiyear-evidence/v2-candidate/frozen-models-v2.json"
VERSION = "pantanal-independent-holdout/1.0.0"
WINDOW = ("2020-01-01", "2026-11-02")  # registered forward test window
DECISIONS = ("accept_v2_candidate_unchanged", "accept_terra_night_alignment", "backward_rule", "insufficient_support_policy")


def examined_dates():
    dates = set()
    for block in acquisition_plan.build_plan()["blocks"]:
        cursor, end = date.fromisoformat(block["solar_start"]), date.fromisoformat(block["solar_end"])
        while cursor <= end:
            dates.add(cursor)
            cursor += timedelta(days=1)
    return dates


def build_plan():
    """Every unseen solar date of the forward test window, split at quarter starts."""
    seen = examined_dates()
    first, last = (date.fromisoformat(value) for value in WINDOW)
    runs, cursor = [], first
    while cursor <= last:
        if cursor not in seen:
            new_run = not runs or runs[-1][1] != cursor - timedelta(days=1) or (cursor.day == 1 and cursor.month in (1, 4, 7, 10))
            if new_run:
                runs.append([cursor, cursor])
            else:
                runs[-1][1] = cursor
        cursor += timedelta(days=1)
    blocks, requests = [], []
    for start, end in runs:
        block_id = "holdout-" + start.isoformat()
        blocks.append({"id": block_id, "solar_start": start.isoformat(), "solar_end": end.isoformat(),
                       "selection": "All forward-window dates absent from the frozen plan; fixed before download and before any score"})
        # Fixed solar midnight is 03:46:36 UTC: include the following UTC date.
        for source in SOURCES:
            cursor = start
            while cursor <= end + timedelta(days=1):
                days = min(5, (end + timedelta(days=1) - cursor).days + 1)
                requests.append({"id": f"{source.lower()}-{cursor.isoformat()}-{block_id}", "block_id": block_id,
                                 "source": source, "bbox": BBOX, "start": cursor.isoformat(), "days": days})
                cursor += timedelta(days=days)
    return {"schema_version": VERSION, "region_id": "pantanal_ibge_2025_reference", "solar_offset_seconds": -13596,
            "sources": list(SOURCES), "bbox": BBOX, "window": list(WINDOW),
            "excluded_examined_plan_fingerprint": fingerprint(acquisition_plan.build_plan()),
            "selection_policy": "Complement of the frozen plan inside the registered forward test window; never chosen using model scores",
            "blocks": blocks, "requests": requests, "request_count": len(requests),
            "solar_date_count": sum((date.fromisoformat(b["solar_end"]) - date.fromisoformat(b["solar_start"])).days + 1 for b in blocks),
            "scientific_status": "acquisition_plan_not_evidence_of_positive_pairs_or_coverage", "harmonization_approved": False}


def load_plan(path=PLAN):
    plan = json.loads(Path(path).read_text())
    if plan != build_plan():
        raise ValueError("Independent holdout plan differs from its frozen version")
    return plan


def holdout_dates(plan):
    dates = set()
    for block in plan["blocks"]:
        cursor, end = date.fromisoformat(block["solar_start"]), date.fromisoformat(block["solar_end"])
        while cursor <= end:
            dates.add(cursor.isoformat())
            cursor += timedelta(days=1)
    return dates


def expected_registration():
    from scientific_thresholds import load_thresholds, threshold_fingerprint
    return {"schema_version": "independent-holdout-registration/1.0.0", "candidate_model_sha256": file_hash(CANDIDATE),
            "holdout_plan_fingerprint": fingerprint(load_plan()), "thresholds_fingerprint": threshold_fingerprint(load_thresholds()),
            "experiment": "forward_validation_primary", "view": "Combined_Terra_Aqua"}


def load_registration(path=REGISTRATION):
    """The scientific owner's recorded decisions; required before any download or score."""
    path = Path(path)
    if not path.exists():
        raise ValueError("Independent holdout is not registered by the scientific owner")
    data = json.loads(path.read_text())
    decisions = data.get("decisions", {})
    if (any(data.get(key) != value for key, value in expected_registration().items())
            or data.get("status") != "registered" or not isinstance(data.get("registered_by"), str) or not data["registered_by"].strip()
            or not isinstance(data.get("registered_at_utc"), str) or not data["registered_at_utc"].endswith("Z")
            or set(decisions) != set(DECISIONS)
            or decisions["accept_v2_candidate_unchanged"] is not True or decisions["accept_terra_night_alignment"] is not True
            or any(not isinstance(decisions[key], str) or not decisions[key].strip() for key in ("backward_rule", "insufficient_support_policy"))):
        raise ValueError("Independent holdout registration is incomplete or does not match the frozen candidate, plan or thresholds")
    return data


def acquire(*, cache, max_new_requests, registration=REGISTRATION, **options):
    from acquire_multiyear import acquire as acquire_frozen
    load_registration(registration)
    return acquire_frozen(root=cache, plan_path=PLAN, max_new_requests=max_new_requests, plan_loader=load_plan, **options)


def reconstruct(*, cache, output, registration=REGISTRATION):
    """Reuse the frozen reconstruction unchanged, bound to the holdout plan."""
    import multiyear_readiness
    load_registration(registration)
    original = multiyear_readiness.load_plan
    multiyear_readiness.load_plan = load_plan
    try:
        return multiyear_readiness.reconstruct(cache=cache, output=output)
    finally:
        multiyear_readiness.load_plan = original


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("write-plan").add_argument("--output", type=Path, required=True)
    command = commands.add_parser("acquire")
    command.add_argument("--cache", type=Path, required=True)
    command.add_argument("--max-new-requests", type=int, required=True)
    command = commands.add_parser("reconstruct")
    command.add_argument("--cache", type=Path, required=True)
    command.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    try:
        if args.command == "write-plan":
            with args.output.open("x") as stream:
                stream.write(json.dumps(build_plan(), indent=2) + "\n")
        elif args.command == "acquire":
            report = acquire(cache=args.cache, max_new_requests=args.max_new_requests, map_key=os.environ.get("FIRMS_MAP_KEY"))
            print(json.dumps({key: report[key] for key in ("completed_requests", "planned_requests", "complete")}))
            if report["failures"]:
                parser.exit(1, "Error: independent holdout acquisition stopped before completion; resume later.\n")
        else:
            result = reconstruct(cache=args.cache, output=args.output)
            print(json.dumps({"completed_blocks": result["completed_blocks"], "missing_blocks": result["missing_blocks"]}))
    except (ValueError, OSError, KeyError, RuntimeError):
        parser.exit(1, "Error: independent holdout step failed validation or is not registered.\n")
