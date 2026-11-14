from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from coverage_evidence import day_evidence


class CoverageEvidenceTests(unittest.TestCase):
    def test_verified_terra_interval_and_previous_solar_day(self):
        self.assertEqual(day_evidence("Terra", "2001-06-14")["operational_state"], "unknown")
        self.assertEqual(day_evidence("Terra", "2001-06-15")["event_ids"], ["TERRA_2001_PS2_SAFE_MODE"])
        self.assertTrue(day_evidence("Terra", "2022-10-22")["block_daily_metric"])
        self.assertEqual(day_evidence("Aqua", "2022-10-22")["operational_state"], "unknown")

    def test_aqua_end_is_previous_solar_day(self):
        self.assertTrue(day_evidence("Aqua", "2022-04-16")["block_daily_metric"])
        self.assertFalse(day_evidence("Aqua", "2022-04-17")["block_daily_metric"])

    def test_snpp_combined_interval(self):
        self.assertTrue(day_evidence("S-NPP", "2022-08-01")["block_daily_metric"])
        self.assertTrue(day_evidence("S-NPP", "2022-08-10")["block_daily_metric"])
        self.assertFalse(day_evidence("S-NPP", "2022-08-11")["block_daily_metric"])

    def test_cutoff_has_partial_day_without_invented_turn_fraction(self):
        partial = day_evidence("S-NPP", "2026-11-02")
        self.assertEqual(partial["operational_state"], "delivery_ended_during_day")
        self.assertFalse(partial["block_daily_metric"])
        self.assertIsNone(partial["coverage_fraction"])
        self.assertIsNone(partial["overpass_count"])
        self.assertTrue(day_evidence("S-NPP", "2026-11-03")["block_daily_metric"])
        self.assertEqual(day_evidence("S-NPP", "2026-11-01")["operational_state"], "unknown")

    def test_closed_endpoint_exactly_at_solar_midnight(self):
        catalog = {"schema_version": "verified-negative-coverage/1.0.0", "cessations": [], "outages": [{
            "satellite": "Terra", "start_utc": "2020-08-01T03:45:00Z", "end_utc": "2020-08-01T03:46:36Z",
            "end_inclusive": True, "event_id": "boundary"}]}
        self.assertTrue(day_evidence("Terra", "2020-07-31", catalog)["block_daily_metric"])
        self.assertTrue(day_evidence("Terra", "2020-08-01", catalog)["block_daily_metric"])
        self.assertFalse(day_evidence("Terra", "2020-08-02", catalog)["block_daily_metric"])

    def test_invalid_and_unverified_coverage_are_not_accepted(self):
        with self.assertRaises(ValueError):
            day_evidence("NOAA-20", "2020-08-01")
        with self.assertRaises(ValueError):
            day_evidence("Terra", "2020-08-01", {"schema_version": "unverified"})
        result = day_evidence("Terra", "2020-08-01")
        self.assertEqual(result["operational_state"], "unknown")
        self.assertIsNone(result["coverage_fraction"])
