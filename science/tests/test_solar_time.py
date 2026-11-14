from datetime import timedelta
import json
from pathlib import Path
import subprocess
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from solar_time import local_solar_date, local_solar_datetime, parse_utc, solar_day_utc_window, solar_dates_touched_by_utc_interval


class SolarTimeTests(unittest.TestCase):
    def test_owner_examples(self):
        self.assertEqual(local_solar_datetime("2020-08-10T03:45:00Z").isoformat(), "2020-08-09T23:58:24")
        self.assertEqual(local_solar_datetime("2020-08-10T03:50:00Z").isoformat(), "2020-08-10T00:03:24")

    def test_exact_midnight(self):
        self.assertEqual(local_solar_date("2020-08-10T03:46:35.999999Z"), "2020-08-09")
        self.assertEqual(local_solar_date("2020-08-10T03:46:36Z"), "2020-08-10")

    def test_calendar_transitions(self):
        self.assertEqual(local_solar_date("2020-03-01T00:00:00Z"), "2020-02-29")
        self.assertEqual(local_solar_date("2021-01-01T00:00:00+00:00"), "2020-12-31")
        self.assertIsNone(local_solar_datetime("2020-08-10T12:00:00Z").tzinfo)

    def test_invalid_or_non_utc(self):
        for value in ["2020-08-10", "2020-08-10T12:00:00", "2020-08-10T12:00:00-04:00", "2020-02-30T12:00:00Z", "2020-08-10T24:00:00Z"]:
            with self.subTest(value=value), self.assertRaises(ValueError):
                parse_utc(value)

    def test_day_window_is_half_open(self):
        start, end = solar_day_utc_window("2020-08-10")
        self.assertEqual(start.isoformat(), "2020-08-10T03:46:36+00:00")
        self.assertEqual(end - start, timedelta(days=1))
        self.assertEqual(local_solar_date((end - timedelta(microseconds=1)).isoformat()), "2020-08-10")
        self.assertEqual(local_solar_date(end.isoformat()), "2020-08-11")
        with self.assertRaises(ValueError):
            solar_day_utc_window("2020-8-10")

    def test_closed_outage_boundary(self):
        self.assertEqual(solar_dates_touched_by_utc_interval("2020-08-10T03:45:00Z", "2020-08-10T03:46:36Z"), ("2020-08-09", "2020-08-10"))
        self.assertEqual(solar_dates_touched_by_utc_interval("2020-08-10T03:46:36Z", "2020-08-10T03:46:36Z"), ("2020-08-10",))
        with self.assertRaises(ValueError):
            solar_dates_touched_by_utc_interval("2020-08-11T00:00:00Z", "2020-08-10T00:00:00Z")

    def test_cli(self):
        script = Path(__file__).resolve().parents[1] / "scripts" / "solar_time.py"
        result = subprocess.run([sys.executable, str(script), "--utc", "2020-08-10T03:45:00Z"], capture_output=True, text=True, check=True)
        self.assertEqual(json.loads(result.stdout)["offset_seconds"], -13596)
        invalid = subprocess.run([sys.executable, str(script), "--utc", "invalid"], capture_output=True, text=True)
        self.assertNotEqual(invalid.returncode, 0)
        self.assertIn("explicit UTC", invalid.stderr)
