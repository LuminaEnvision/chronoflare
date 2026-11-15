from datetime import date, timedelta
from pathlib import Path
import sys
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from acquisition_plan import build_plan, load_plan


class AcquisitionPlanTests(unittest.TestCase):
    def test_frozen_plan_has_two_sources_and_exact_utc_padding(self):
        plan = load_plan(Path(__file__).resolve().parents[1] / "configs/acquisition_plan.json")
        self.assertEqual(plan["request_count"], 416)
        self.assertEqual(plan["solar_date_count"], 1008)
        self.assertEqual(len({r["id"] for r in plan["requests"]}), 416)
        for block in plan["blocks"]:
            for source in plan["sources"]:
                days = []
                for row in plan["requests"]:
                    if row["block_id"] == block["id"] and row["source"] == source:
                        self.assertTrue(1 <= row["days"] <= 5)
                        days.extend(date.fromisoformat(row["start"]) + timedelta(days=i) for i in range(row["days"]))
                self.assertEqual(len(days), 64)
                self.assertEqual(len(set(days)), 64)
                self.assertEqual(min(days).isoformat(), block["solar_start"])
                self.assertEqual(max(days), date.fromisoformat(block["solar_end"]) + timedelta(days=1))

    def test_years_cover_both_experiments_without_changing_splits(self):
        years = {int(b["solar_start"][:4]) for b in build_plan()["blocks"]}
        self.assertGreaterEqual(len(years & set(range(2012, 2020))), 3)
        self.assertGreaterEqual(len(years & set(range(2020, 2027))), 2)
        self.assertGreaterEqual(len(years & set(range(2012, 2016))), 2)
        self.assertGreaterEqual(len(years & set(range(2016, 2027))), 3)
