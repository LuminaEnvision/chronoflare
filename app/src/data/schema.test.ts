import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { aggregateSchema, parseDataset } from "./schema";
import { calendarSlot } from "./load";
const read = (path: string) =>
  JSON.parse(readFileSync(`app/public/data/v1/${path}`, "utf8"));
const manifest = read("manifest.json");
const calendar = read("regions/pantanal-pilot/calendar/day.json");
const validation = read("validation/summary.json");
const example = calendar.records.find(
  (r: { metric_value: number | null }) => r.metric_value !== null,
);
test("valid fixtures keep harmonization blocked and preserve leap years", () => {
  const d = parseDataset(manifest, calendar, validation);
  assert.equal(d.approved, false);
  assert.equal(d.manifest.data_status, "fixture");
  assert.equal(
    d.calendar.records.filter((r) => r.period_start === "2024-02-29").length,
    2,
  );
  assert.equal(
    d.calendar.records.filter((r) => r.period_start === "2023-02-29").length,
    0,
  );
});
test("missing data cannot become zero; zero requires adequate coverage", () => {
  assert.equal(
    aggregateSchema.safeParse({
      ...example,
      coverage_flag: "no_data",
      metric_value: 0,
    }).success,
    false,
  );
  assert.equal(
    aggregateSchema.safeParse({
      ...example,
      coverage_flag: "partial",
      metric_value: 0,
    }).success,
    false,
  );
  assert.equal(
    aggregateSchema.safeParse({
      ...example,
      coverage_flag: "ok",
      metric_value: 0,
    }).success,
    true,
  );
  assert.equal(
    aggregateSchema.safeParse({
      ...example,
      coverage_flag: "no_data",
      metric_value: null,
    }).success,
    true,
  );
});
test("extrapolation requires an estimate and estimates require intervals", () => {
  assert.equal(
    aggregateSchema.safeParse({ ...example, is_extrapolated: true }).success,
    false,
  );
  assert.equal(
    aggregateSchema.safeParse({
      ...example,
      value_basis: "estimated_from_modis",
    }).success,
    false,
  );
});
test("version mismatches block interpretation", () => {
  assert.throws(
    () =>
      parseDataset(
        manifest,
        { ...calendar, dataset_version: "other" },
        validation,
      ),
    /versions/,
  );
  const records = [{ ...example, dataset_version: "other" }];
  assert.throws(
    () => parseDataset(manifest, { ...calendar, records }, validation),
    /versions/,
  );
});
test("not-run status never approves harmonization", () => {
  assert.throws(
    () =>
      parseDataset(
        { ...manifest, harmonization_approved: true, decision: "plan_a" },
        calendar,
        { ...validation, decision: "plan_a" },
      ),
    /approval/,
  );
});
test("plan B accepts original bases and blocks estimates", () => {
  assert.equal(
    parseDataset({ ...manifest, decision: "plan_b" }, calendar, {
      ...validation,
      status: "failed",
      decision: "plan_b",
    }).approved,
    false,
  );
  assert.throws(
    () =>
      parseDataset(
        manifest,
        {
          ...calendar,
          records: [
            {
              ...example,
              value_basis: "estimated_from_modis",
              uncertainty_lower: 1,
              uncertainty_upper: 20,
              interval_level: 0.8,
            },
          ],
        },
        validation,
      ),
    /Estimates are blocked/,
  );
});
test("plan A requires evidence before enabling the series", () => {
  assert.throws(
    () =>
      parseDataset(
        { ...manifest, decision: "plan_a", harmonization_approved: true },
        calendar,
        { ...validation, status: "passed", decision: "plan_a" },
      ),
    /evidence/,
  );
});
test("real data requires a date range and provenance", () => {
  assert.throws(
    () =>
      parseDataset({ ...manifest, data_status: "real" }, calendar, validation),
    /provenance/,
  );
});
test("duplicates and inconsistent regions block the dataset", () => {
  assert.throws(
    () =>
      parseDataset(
        manifest,
        { ...calendar, records: [example, example] },
        validation,
      ),
    /Duplicate/,
  );
  assert.throws(
    () =>
      parseDataset(manifest, { ...calendar, region_id: "other" }, validation),
    /Region/,
  );
});
test("February 29 does not shift March in other years", () => {
  assert.equal(calendarSlot("2024-02-29"), 59);
  assert.equal(calendarSlot("2023-03-01"), 60);
  assert.equal(calendarSlot("2024-03-01"), 60);
  assert.equal(calendarSlot("2025-12-31"), 365);
});
test("impossible dates and reversed periods are rejected", () => {
  assert.equal(
    aggregateSchema.safeParse({ ...example, period_start: "2023-02-29" })
      .success,
    false,
  );
  assert.equal(
    aggregateSchema.safeParse({ ...example, period_end: example.period_start })
      .success,
    false,
  );
});

test("plan A keeps original and harmonized records without identity collisions", () => {
  const calibration = "calibration-test-only";
  const m = { ...manifest, decision: "plan_a", harmonization_approved: true };
  const v = {
    ...validation,
    status: "passed",
    decision: "plan_a",
    thresholds_registered_at: "2026-11-14T00:00:00Z",
    thresholds: { test_only: true },
    results_by_platform: [{ test_only: true }],
    calibration_version: calibration,
  };
  const c = {
    ...calendar,
    calibration_version: calibration,
    records: [
      example,
      {
        ...example,
        metric_name: "harmonized_frp_index",
        calibration_version: calibration,
      },
    ],
  };
  assert.equal(parseDataset(m, c, v).approved, true);
});
