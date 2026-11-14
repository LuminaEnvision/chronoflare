"""Explicit regional mean solar time; never infer observation coverage."""
import argparse
from datetime import date, datetime, time, timedelta, timezone
import json
import re

REFERENCE_LONGITUDE_DEGREES = "-56.65"
OFFSET_SECONDS = -13596
RULE_VERSION = "pantanal-fixed-reference/1.0.0"


def parse_utc(value: str) -> datetime:
    """Require an explicit UTC timestamp rather than a civil or naive time."""
    if not isinstance(value, str) or not re.fullmatch(
        r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|\+00:00)", value
    ):
        raise ValueError("Expected an ISO timestamp with explicit UTC (Z or +00:00)")
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def local_solar_datetime(utc_timestamp: str) -> datetime:
    """Return naive mean solar time, not a civil time zone or UTC instant."""
    return (parse_utc(utc_timestamp) + timedelta(seconds=OFFSET_SECONDS)).replace(tzinfo=None)


def local_solar_date(utc_timestamp: str) -> str:
    return local_solar_datetime(utc_timestamp).date().isoformat()


def solar_day_utc_window(day: str) -> tuple[datetime, datetime]:
    """Return a half-open UTC interval [start, end) for one regional solar day."""
    if not isinstance(day, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", day):
        raise ValueError("Expected a calendar date in YYYY-MM-DD format")
    start = datetime.combine(date.fromisoformat(day), time(), timezone.utc) - timedelta(seconds=OFFSET_SECONDS)
    return start, start + timedelta(days=1)


def solar_dates_touched_by_utc_interval(start: str, end: str) -> tuple[str, ...]:
    """Expand an exact closed UTC interval into affected whole solar dates.

    Callers must verify endpoints and product scope before using this for outages.
    A closed endpoint exactly at solar midnight touches the following day too.
    """
    if parse_utc(end) < parse_utc(start):
        raise ValueError("Interval end must not precede its start")
    first = local_solar_datetime(start).date()
    last = local_solar_datetime(end).date()
    return tuple((first + timedelta(days=index)).isoformat() for index in range((last - first).days + 1))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--utc", required=True, help="Explicit UTC timestamp")
    args = parser.parse_args()
    try:
        solar = local_solar_datetime(args.utc)
        start, end = solar_day_utc_window(solar.date().isoformat())
    except (ValueError, OverflowError) as error:
        parser.error(str(error))
    print(json.dumps({
        "rule_version": RULE_VERSION,
        "reference_longitude_degrees": REFERENCE_LONGITUDE_DEGREES,
        "offset_seconds": OFFSET_SECONDS,
        "local_mean_solar_datetime": solar.isoformat(),
        "local_solar_date": solar.date().isoformat(),
        "period_start_utc": start.isoformat(),
        "period_end_utc_exclusive": end.isoformat(),
    }, indent=2))


if __name__ == "__main__":
    main()
