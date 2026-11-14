import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  loadSolarPreview,
  solarPreviewSchema,
  solarSearch,
  solarSelection,
} from "./experimental-solar";
const input = () =>
  JSON.parse(
    readFileSync("app/public/data/experimental/v1/pantanal-solar.json", "utf8"),
  );
test("real preview validates all padded solar days while retaining unreviewed status", () => {
  const data = solarPreviewSchema.parse(input());
  assert.equal(data.records.length, 45);
  assert.equal(data.scientific_approval, false);
  assert.equal(data.approved_metric, false);
  assert.equal(data.provenance.length, 8);
  assert.equal(
    data.records.filter((row) => row.solar_date === "2020-08-15").length,
    3,
  );
  assert.ok(
    data.records.every(
      (row) => row.coverage_status === "unknown" && row.overpass_count === null,
    ),
  );
});
test("rejects approval, observed-zero and incomplete solar-window claims", () => {
  for (const change of [
    (value: any) => {
      value.scientific_approval = true;
    },
    (value: any) => {
      value.records[0].coverage_status = "ok";
    },
    (value: any) => {
      value.records[0].all_detections.detection_count = 0;
    },
    (value: any) => {
      value.records[0].period_start_utc = "2020-08-01T00:00:00Z";
    },
    (value: any) => {
      value.records[0].input_window_complete = false;
    },
  ]) {
    const value = input();
    change(value);
    assert.equal(solarPreviewSchema.safeParse(value).success, false);
  }
});
test("rejects duplicated days, inconsistent quality counts and missing padding provenance", () => {
  for (const change of [
    (value: any) => {
      value.records[1] = value.records[0];
    },
    (value: any) => {
      value.records[0].proposed_filter.detection_count = 999999;
    },
    (value: any) => {
      value.provenance[7].requested_start_utc = "2020-08-15";
    },
    (value: any) => {
      value.input_csv_sha256[0] = "0".repeat(64);
    },
  ]) {
    const value = input();
    change(value);
    assert.equal(solarPreviewSchema.safeParse(value).success, false);
  }
});
test("experimental URL namespace preserves calendar, comparison and map selections", () => {
  const original =
    "?view=calendar&basis=viirs&date=2025-09-24&years=2025%2C2024&raw_source=modis";
  const next = solarSearch(original, {
    calendar_data: "experimental",
    solar_day: "2020-08-15",
    solar_platform: "Terra",
    solar_filter: "proposed",
  });
  assert.deepEqual(solarSelection(next), {
    experimental: true,
    platform: "Terra",
    day: "2020-08-15",
    filtered: true,
  });
  for (const [key, value] of new URLSearchParams(original))
    assert.equal(new URLSearchParams(next).get(key), value);
  const demo = solarSearch(next, { calendar_data: "" });
  assert.equal(solarSelection(demo).experimental, false);
  assert.equal(new URLSearchParams(demo).get("date"), "2025-09-24");
  assert.equal(
    solarSelection("?solar_day=2020-02-30&solar_platform=unknown").day,
    "2020-08-01",
  );
});
test("failed experimental fetch rejects without touching the demonstration loader", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response("Unavailable", { status: 503 });
  try {
    await assert.rejects(
      loadSolarPreview(new AbortController().signal),
      /could not be loaded/,
    );
  } finally {
    globalThis.fetch = original;
  }
});
