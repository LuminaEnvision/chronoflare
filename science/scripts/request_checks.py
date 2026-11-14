"""Check declared FIRMS request windows without inferring observation coverage."""

from datetime import date
import json
from pathlib import Path
import re

from normalize_detections import NormalizationError


def validate_request(value):
    if not isinstance(value, dict) or set(value) != {"id", "start_date", "end_date"}:
        raise NormalizationError("Request requires id, start_date and end_date only.")
    if not isinstance(value["id"], str) or not re.fullmatch(r"[0-9]{1,32}", value["id"]):
        raise NormalizationError("FIRMS request id must contain 1–32 digits.")
    for key in ("start_date", "end_date"):
        try:
            if not isinstance(value[key], str) or date.fromisoformat(value[key]).isoformat() != value[key]:
                raise ValueError()
        except ValueError:
            raise NormalizationError("Request dates must be valid YYYY-MM-DD dates.") from None
    if value["start_date"] > value["end_date"]:
        raise NormalizationError("Request start_date must not follow end_date.")
    return value


def check_request(rows_path: Path, request: dict):
    validate_request(request)
    before = after = inside = 0
    with rows_path.open(encoding="utf-8") as stream:
        for line in stream:
            day = json.loads(line)["acquired_at_utc"][:10]
            if day < request["start_date"]:
                before += 1
            elif day > request["end_date"]:
                after += 1
            else:
                inside += 1
    return {"request": dict(request), "date_basis": "UTC", "end_date_inclusive": True,
            "before_window_count": before, "after_window_count": after, "within_window_count": inside,
            "status": "outside_window" if before or after else "no_records" if not inside else "within_window",
            "notice": "Declared request metadata is not authenticated. Dates describe detection timestamps, not complete coverage. All records are retained."}
