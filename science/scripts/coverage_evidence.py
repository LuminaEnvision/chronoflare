"""Selected verified negative evidence; absence of an outage never proves coverage."""
import json
from pathlib import Path

from solar_time import parse_utc, solar_day_utc_window

CATALOG = Path(__file__).resolve().parents[1] / "configs/known_outages_utc.json"


def day_evidence(satellite, solar_date, catalog=None):
    catalog = json.loads(CATALOG.read_text()) if catalog is None else catalog
    if catalog.get("schema_version") != "verified-negative-coverage/1.0.0":
        raise ValueError("Unsupported negative-evidence catalogue")
    if satellite not in ("Terra", "Aqua", "S-NPP"):
        raise ValueError("Unsupported platform")
    start, end = solar_day_utc_window(solar_date)
    events = []
    for event in catalog["outages"]:
        first, last = parse_utc(event["start_utc"]), parse_utc(event["end_utc"])
        if first > last or event["end_inclusive"] is not True:
            raise ValueError("Expected a valid closed UTC outage interval")
        if event["satellite"] == satellite and start <= last and end > first:
            events.append(event["event_id"])
    state = "known_outage_day" if events else "unknown"
    for cessation in catalog["cessations"]:
        if cessation["satellite"] != satellite:
            continue
        cutoff = parse_utc(cessation["at_utc"])
        if start >= cutoff:
            state = "new_data_delivery_ended"
        elif start < cutoff < end:
            state = "delivery_ended_during_day"
    return {
        "operational_state": state, "event_ids": events,
        "block_daily_metric": state in ("known_outage_day", "new_data_delivery_ended"),
        "coverage_fraction": None, "overpass_count": None,
        "notice": "Negative evidence only. Unknown or partly available operation does not establish observed AOI coverage.",
    }
