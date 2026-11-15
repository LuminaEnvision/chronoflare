import json
from pathlib import Path
import sys
import tempfile
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import export_harmonized_series as exporter
from normalize_detections import file_hash

PROJECT = Path(__file__).resolve().parents[2]
SERIES = PROJECT / "docs/multiyear-evidence/harmonized-series/pantanal-harmonized-daily-v2.json"
MODEL = json.loads((exporter.EVIDENCE / "frozen-models-v2.json").read_text())["models"][exporter.EXPERIMENT]


def cell(day, platform, turn, value):
    return {"solar_date": day, "platform": platform, "day_night": turn, "observed_frp_sum_mw": value}


class ExportHarmonizedSeriesTests(unittest.TestCase):
    def test_export_requires_the_registered_plan_a_decision_and_matching_hashes(self):
        decision, summary = exporter.load_decision()
        self.assertEqual((decision["decision"], decision["harmonization_approved"]), ("plan_a", True))
        self.assertTrue(summary["all_registered_forward_combined_checks_met"])
        original = json.loads(exporter.DECISION.read_text())
        with tempfile.TemporaryDirectory() as temporary:
            for change in ({"decision": "plan_b"}, {"harmonization_approved": False}, {"status": "proposed"}, {"registered_by": ""},
                           {"approved_model": {**original["approved_model"], "frozen_models_sha256": "0" * 64}},
                           {"evidence": {**original["evidence"], "independent_summary_sha256": "0" * 64}}):
                path = Path(temporary) / "decision.json"
                path.write_text(json.dumps({**original, **change}))
                with self.assertRaises(ValueError):
                    exporter.load_decision(path)
            empty = Path(temporary) / "observations.json"
            empty.write_text(json.dumps({"cells": []}))
            with self.assertRaises(ValueError):  # observations must be the ones the evidence used
                exporter.export(observations=empty, holdout_observations=empty, output=Path(temporary) / "series.json")
            self.assertFalse((Path(temporary) / "series.json").exists())

    def test_only_dates_with_both_platforms_complete_are_exported_and_absence_is_never_zero(self):
        cells = [cell("2020-08-09", "Terra", "N", 40.)]
        for day in ("2020-08-10", "2020-08-11", "2020-08-12"):
            cells += [cell(day, "Terra", "D", 100.), cell(day, "Terra", "N", 40.), cell(day, "Aqua", "D", 200.), cell(day, "Aqua", "N", 60.)]
        cells += [cell("2020-08-10", "S-NPP", "D", 300.), cell("2020-08-10", "S-NPP", "N", 80.), cell("2020-08-11", "S-NPP", "D", 300.)]
        cells = [c for c in cells if (c["solar_date"], c["platform"], c["day_night"]) != ("2020-08-12", "Aqua", "N")]
        cells.append(cell("2020-08-12", "Aqua", "N", None))
        rows = exporter.daily_series(MODEL, cells, {"2020-08-11"})
        self.assertEqual([row["solar_date"] for row in rows], ["2020-08-10", "2020-08-11"])
        first, second = rows
        self.assertEqual(first["snpp_observed_frp_mw"], 380.)
        self.assertIsNone(second["snpp_observed_frp_mw"])  # one S-NPP turn is absent, not zero
        self.assertEqual((first["sample_role"], second["sample_role"]), ("post_hoc_examined_holdout", "independent_holdout"))
        weights = MODEL["weight_fit"]["weights"]
        for row in rows:
            self.assertAlmostEqual(row["harmonized_frp_mw"], weights["Terra"] * row["terra_calibrated_frp_mw"] + weights["Aqua"] * row["aqua_calibrated_frp_mw"])
            self.assertAlmostEqual(row["native_weighted_modis_frp_mw"], weights["Terra"] * 140. + weights["Aqua"] * 260.)
            self.assertLessEqual(row["interval_80_lower_mw"], row["harmonized_frp_mw"])
            self.assertGreaterEqual(row["interval_80_upper_mw"], row["harmonized_frp_mw"])
        # The Terra night input comes from the previous solar date: without it the first date is dropped.
        self.assertEqual([row["solar_date"] for row in exporter.daily_series(MODEL, cells[1:], set())], ["2020-08-11"])
        huge = [({**c, "observed_frp_sum_mw": 1e7} if (c["solar_date"], c["platform"], c["day_night"]) == ("2020-08-10", "Aqua", "D") else c) for c in cells]
        flagged = exporter.daily_series(MODEL, huge, set())[0]
        self.assertTrue(flagged["is_extrapolated"])
        self.assertEqual(exporter.sample_role("2015-08-10", MODEL, set()), "training_window_in_sample")
        with self.assertRaises(ValueError):
            exporter.daily_series(MODEL, cells + cells[:1], set())

    def test_weekly_statistic_needs_five_valid_days(self):
        rows = [{"solar_date": f"2020-08-{day:02d}", "harmonized_frp_mw": float(day), "native_weighted_modis_frp_mw": 1., "snpp_observed_frp_mw": 2.,
                 "is_extrapolated": day == 10} for day in (10, 11, 12, 13, 14, 17, 18, 19, 20)]
        weeks = exporter.weekly_series(rows)
        self.assertEqual(len(weeks), 1)
        self.assertEqual((weeks[0]["iso_week_start"], weeks[0]["valid_days"], weeks[0]["extrapolated_days"]), ("2020-08-10", 5, 1))
        self.assertAlmostEqual(weeks[0]["harmonized_frp_mw_daily_mean"], 12.)

    def test_committed_series_matches_the_decision_model_and_scope(self):
        series = json.loads(SERIES.read_text())
        decision = json.loads(exporter.DECISION.read_text())
        self.assertEqual(series["schema_version"], exporter.SCHEMA)
        self.assertEqual(series["decision"]["decision_sha256"], file_hash(exporter.DECISION))
        self.assertEqual(series["model"]["frozen_models_sha256"], file_hash(exporter.EVIDENCE / "frozen-models-v2.json"))
        self.assertEqual((series["approved_claim"], series["publication_scope"]), (decision["approved_claim"], decision["publication_scope"]))
        self.assertEqual(series["series_sha256"], exporter.fingerprint({"daily": series["daily"], "weekly": series["weekly"]}))
        dates = [row["solar_date"] for row in series["daily"]]
        self.assertEqual(dates, sorted(set(dates)))
        self.assertEqual(len(dates), series["coverage"]["exported_days"])
        for row in series["daily"]:
            self.assertGreater(row["harmonized_frp_mw"], 0)
            self.assertLessEqual(row["interval_80_lower_mw"], row["interval_80_upper_mw"])
            self.assertIn(row["sample_role"], series["interpretation"]["sample_role"])
        self.assertTrue(all(week["valid_days"] >= 5 for week in series["weekly"]))

    def test_native_turn_is_null_without_selected_positives_and_rejects_invalid_values(self):
        self.assertIsNone(exporter.native_turn(None))
        self.assertIsNone(exporter.native_turn({"observed_frp_sum_mw": None, "observed_detection_count": None}))
        self.assertEqual(exporter.native_turn({"observed_frp_sum_mw": 12.5, "observed_detection_count": 2}), {"frp_mw": 12.5, "count": 2})
        for value, count in ((0., 1), (-1., 1), (float("inf"), 1), (5., 0), (5., 1.5), (None, 3), (True, 1)):
            with self.assertRaises(ValueError):
                exporter.native_turn({"observed_frp_sum_mw": value, "observed_detection_count": count})

    def test_committed_app_export_follows_the_contract_and_reconciles_with_native_rows(self):
        from datetime import date, timedelta
        manifest = json.loads((exporter.APP_OUTPUT / "manifest.json").read_text())
        decision = json.loads(exporter.DECISION.read_text())
        self.assertEqual(set(manifest), {"schema_version", "region_id", "region_name", "solar_offset_seconds", "coverage_status", "quality_rule_version",
                                         "dedup_rule_version", "source_observation_sha256", "approval", "years"})
        self.assertEqual((manifest["schema_version"], manifest["coverage_status"], manifest["solar_offset_seconds"]), ("chronoflare-observations/1.0.0", "unknown", -13596))
        self.assertEqual(manifest["approval"], {"decision": "plan_a", "reviewed_by": "André Salles", "scope": "both_complete_platforms",
                                                "model_sha256": file_hash(exporter.EVIDENCE / "frozen-models-v2.json"),
                                                "record_path": "science/configs/harmonization_decision.json", "approved_claim": decision["approved_claim"]})
        self.assertTrue((PROJECT / manifest["approval"]["record_path"]).exists())
        self.assertEqual({item.name for item in exporter.APP_OUTPUT.iterdir()}, {"manifest.json"} | {f"{row['year']}.json" for row in manifest["years"]})
        series = {row["solar_date"]: row for row in json.loads(SERIES.read_text())["daily"]}
        native, harmonized, total = {}, {}, 0
        for entry in manifest["years"]:
            self.assertEqual(set(entry), {"year", "path", "sha256", "bytes", "day_count"})
            path = exporter.APP_OUTPUT / f"{entry['year']}.json"
            self.assertEqual((entry["path"], entry["sha256"], entry["bytes"]), (f"/data/observations/v1/{entry['year']}.json", file_hash(path), path.stat().st_size))
            year = json.loads(path.read_text())
            self.assertEqual((year["schema_version"], year["year"], len(year["days"])), ("chronoflare-observation-year/1.0.0", entry["year"], entry["day_count"]))
            dates = [row["date"] for row in year["days"]]
            self.assertEqual(dates, sorted(set(dates)))
            self.assertTrue(all(day.startswith(str(entry["year"])) for day in dates))
            for row in year["days"]:
                total += 1
                self.assertEqual(set(row), {"date", "terra", "aqua", "snpp", "harmonized"})
                for platform in ("terra", "aqua", "snpp"):
                    self.assertEqual(set(row[platform]), {"day", "night"})
                    for turn in row[platform].values():
                        if turn is not None:
                            self.assertTrue(turn["frp_mw"] > 0 and type(turn["count"]) is int and turn["count"] > 0)
                native[row["date"]] = row
                if row["harmonized"] is not None:
                    harmonized[row["date"]] = row["harmonized"]
        self.assertEqual(total, 4318)
        self.assertEqual(set(harmonized), set(series))
        for day, value in harmonized.items():
            self.assertEqual(set(value), {"value_mw", "lower_mw", "upper_mw", "is_extrapolated", "regime", "inputs"})
            self.assertEqual(value["regime"], "Terra+Aqua_weighted")
            self.assertTrue(value["value_mw"] > 0 and 0 <= value["lower_mw"] <= value["upper_mw"])
            self.assertEqual((value["value_mw"], value["is_extrapolated"]), (series[day]["harmonized_frp_mw"], series[day]["is_extrapolated"]))
            inputs, row = value["inputs"], native[day]
            source = inputs["terra_night_source_date"]
            self.assertEqual(date.fromisoformat(source), date.fromisoformat(day) - timedelta(days=1))
            self.assertEqual((inputs["terra_day_mw"], inputs["aqua_day_mw"], inputs["aqua_night_mw"], inputs["terra_night_mw"]),
                             (row["terra"]["day"]["frp_mw"], row["aqua"]["day"]["frp_mw"], row["aqua"]["night"]["frp_mw"], native[source]["terra"]["night"]["frp_mw"]))
        # No estimate is withheld from a date whose four inputs exist.
        for day, row in native.items():
            previous = native.get((date.fromisoformat(day) - timedelta(days=1)).isoformat())
            complete = bool(row["terra"]["day"] and row["aqua"]["day"] and row["aqua"]["night"] and previous and previous["terra"]["night"])
            self.assertEqual(complete, day in harmonized)

    def test_app_export_refuses_an_unsafe_directory(self):
        with tempfile.TemporaryDirectory() as temporary:
            (Path(temporary) / "other.txt").write_text("keep")
            empty = Path(temporary) / "observations.json"
            with self.assertRaises((ValueError, OSError)):
                exporter.export_app(observations=empty, holdout_observations=empty, output=Path(temporary))
            self.assertTrue((Path(temporary) / "other.txt").exists())


if __name__ == "__main__":
    unittest.main()
