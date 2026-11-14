import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseDataset, type ActivityAggregate, type Dataset } from "./schema";
import { buildAnnualComparison, comparisonAxis } from "./annual-comparison";
import type { Basis } from "./selection";

const read = (path: string) =>
  JSON.parse(readFileSync(`app/public/data/v1/${path}`, "utf8"));
const manifest = read("manifest.json"),
  calendar = read("regions/pantanal-pilot/calendar/day.json"),
  validation = read("validation/summary.json");
const template: ActivityAggregate = calendar.records.find(
  (r: ActivityAggregate) => r.metric_name === "viirs_frp_sum",
);
const calibration = "comparison-test-only";
function record(
  date: string,
  value: number | null,
  extra: Partial<ActivityAggregate> = {},
): ActivityAggregate {
  const next = new Date(date + "T00:00:00Z");
  next.setUTCDate(next.getUTCDate() + 1);
  return {
    ...template,
    period_start: date,
    period_end: next.toISOString().slice(0, 10),
    metric_value: value,
    viirs_frp_sum: value,
    coverage_flag: "ok",
    coverage_fraction:
      extra.coverage_flag === "no_data"
        ? null
        : extra.coverage_flag === "partial"
          ? 0.5
          : 1,
    ...extra,
  };
}
function data(records: ActivityAggregate[], approved = false): Dataset {
  return parseDataset(
    {
      ...manifest,
      decision: approved ? "plan_a" : "pending",
      harmonization_approved: approved,
    },
    {
      ...calendar,
      records,
      calibration_version: approved ? calibration : null,
    },
    {
      ...validation,
      decision: approved ? "plan_a" : "pending",
      status: approved ? "passed" : "not_run",
      calibration_version: approved ? calibration : null,
      thresholds_registered_at: approved ? "2026-11-14T00:00:00Z" : null,
      thresholds: approved ? { test_only: true } : null,
      results_by_platform: approved ? [{ test_only: true }] : [],
    },
  );
}
const compare = (dataset: Dataset, basis: Basis = "viirs") =>
  buildAnnualComparison(dataset, { basis, years: [2024, 2023] });

test("annual series share a 366-slot month/day axis and retain actual leap days", () => {
  const result = compare(
    data([
      record("2023-02-28", 1),
      record("2023-03-01", 2),
      record("2024-02-28", 3),
      record("2024-02-29", 4),
      record("2024-03-01", 5),
    ]),
  );
  assert.equal(comparisonAxis.length, 366);
  assert.deepEqual(
    result.series.map((s) => s.year),
    [2024, 2023],
  );
  const [leap, ordinary] = result.series;
  assert.equal(leap.points[59].date, "2024-02-29");
  assert.equal(leap.points[59].value, 4);
  assert.equal(ordinary.points[59].status, "not_in_year");
  assert.equal(ordinary.points[59].date, null);
  assert.equal(ordinary.points[59].record, null);
  assert.equal(ordinary.points[60].date, "2023-03-01");
  assert.equal(ordinary.points[60].value, 2);
  assert.equal(leap.counts.calendarDays, 366);
  assert.equal(ordinary.counts.calendarDays, 365);
  assert.equal(ordinary.counts.notInYearSlots, 1);
});

test("missing records, absent values, partial observations and measured zero stay distinct", () => {
  const result = compare(
    data([
      record("2023-01-01", 1),
      record("2024-01-01", 0),
      record("2024-01-03", null, {
        coverage_flag: "no_data",
        coverage_fraction: null,
      }),
      record("2024-01-04", 7, {
        coverage_flag: "partial",
        coverage_fraction: 0.5,
      }),
      record("2024-01-05", null),
    ]),
  );
  const series = result.series[0];
  assert.equal(series.points[0].status, "available");
  assert.equal(series.points[0].value, 0);
  assert.equal(series.points[1].status, "missing_record");
  assert.equal(series.points[1].value, null);
  assert.equal(series.points[2].status, "no_data");
  assert.equal(series.points[2].value, null);
  assert.equal(series.points[3].status, "partial");
  assert.equal(series.points[3].value, 7);
  assert.equal(series.points[4].status, "no_value");
  assert.equal(series.counts.recordDays, 4);
  assert.equal(series.counts.valueDays, 2);
  assert.equal(series.counts.zeroDays, 1);
  assert.equal(series.counts.noDataDays, 1);
  assert.equal(series.counts.partialDays, 1);
  assert.equal(series.counts.missingRecordDays, 362);
});

test("chart segments break at gaps, null values and partial-coverage transitions", () => {
  const result = compare(
    data([
      record("2023-02-27", 1),
      record("2024-02-27", 2),
      record("2024-02-28", 3),
      record("2024-02-29", null, { coverage_flag: "no_data" }),
      record("2024-03-01", 4),
      record("2024-03-02", 5, { coverage_flag: "partial" }),
      record("2024-03-03", 6),
      record("2024-03-04", null),
      record("2024-03-05", 7),
    ]),
  );
  assert.deepEqual(
    result.series[0].segments.map((s) => [s.startSlot, s.endSlot, s.status]),
    [
      [57, 58, "available"],
      [60, 60, "available"],
      [61, 61, "partial"],
      [62, 62, "available"],
      [64, 64, "available"],
    ],
  );
});

test("all-null data has no value extent or fabricated zero series", () => {
  const result = compare(
    data([
      record("2023-01-01", null, { coverage_flag: "no_data" }),
      record("2024-01-01", null, { coverage_flag: "no_data" }),
    ]),
  );
  assert.equal(result.valueExtent, null);
  for (const series of result.series) {
    assert.equal(series.counts.valueDays, 0);
    assert.equal(series.counts.zeroDays, 0);
    assert.deepEqual(series.segments, []);
  }
});

test("zero-only data retains the measured zero and exact extent", () => {
  const result = compare(
    data([record("2023-01-01", 0), record("2024-01-01", 0)]),
  );
  assert.deepEqual(result.valueExtent, { min: 0, max: 0 });
  assert.equal(result.series[0].counts.zeroDays, 1);
  assert.equal(result.series[0].segments.length, 1);
});

test("the same requested basis is used for both years without mixing sensor scales", () => {
  const originals = [record("2023-01-01", 1), record("2024-01-01", 2)];
  const modis = originals.map((r) => ({
    ...r,
    metric_name: "modis_frp_sum",
    value_basis: "observed_modis" as const,
    metric_value: r.metric_value! * 100,
    modis_frp_sum: r.metric_value! * 100,
    viirs_frp_sum: null,
  }));
  const dataset = data([...modis, ...originals]);
  assert.deepEqual(compare(dataset).valueExtent, { min: 1, max: 2 });
  assert.deepEqual(compare(dataset, "modis").valueExtent, {
    min: 100,
    max: 200,
  });
  assert.equal(compare(dataset).metricName, "viirs_frp_sum");
});

test("unapproved or absent harmonized bases cannot become comparison series", () => {
  const dataset = data([record("2023-01-01", 1), record("2024-01-01", 2)]);
  assert.throws(() => compare(dataset, "harmonized"), /unavailable|approval/);
  assert.throws(() => compare(dataset, "__proto__" as Basis), /Unknown/);
});

test("approved comparison preserves observed/estimated basis, extrapolation and intervals", () => {
  const estimated = (date: string, value: number, extrapolated: boolean) =>
    record(date, value, {
      metric_name: "harmonized_frp_index",
      value_basis: "estimated_from_modis",
      calibration_version: calibration,
      is_extrapolated: extrapolated,
      uncertainty_lower: value - 1,
      uncertainty_upper: value + 1,
      interval_level: 0.8,
      estimation_method: "ratio",
      calibration_stratum: "test-only",
    });
  const dataset = data(
    [
      estimated("2011-02-27", 10, true),
      estimated("2012-02-27", 20, false),
      estimated("2012-02-28", 21, false),
      record("2012-02-29", 22, {
        metric_name: "harmonized_frp_index",
        calibration_version: calibration,
      }),
    ],
    true,
  );
  const result = buildAnnualComparison(dataset, {
    basis: "harmonized",
    years: [2012, 2011],
  });
  assert.equal(result.units, "relative index");
  assert.deepEqual(
    result.series[0].segments.map((s) => [
      s.startSlot,
      s.endSlot,
      s.valueBasis,
    ]),
    [
      [57, 58, "estimated_from_modis"],
      [59, 59, "observed_viirs"],
    ],
  );
  const point = result.series[1].points[57];
  assert.equal(point.record?.is_extrapolated, true);
  assert.equal(point.record?.uncertainty_lower, 9);
  assert.equal(point.record?.uncertainty_upper, 11);
  assert.equal(point.record?.interval_level, 0.8);
  assert.equal(result.series[1].segments[0].isExtrapolated, true);
});

test("invalid, duplicate or unavailable comparison years fail explicitly", () => {
  const dataset = data([record("2023-01-01", 1), record("2024-01-01", 2)]);
  for (const years of [
    [2024, 2024],
    [0, 2024],
    [10000, 2024],
    [NaN, 2024],
    [2023.5, 2024],
  ] as [number, number][]) {
    assert.throws(
      () => buildAnnualComparison(dataset, { basis: "viirs", years }),
      /distinct calendar years/,
    );
  }
  assert.throws(
    () =>
      buildAnnualComparison(dataset, { basis: "viirs", years: [2024, 2022] }),
    /No records/,
  );
});

test("inconsistent source labels and duplicate records cannot be silently displayed", () => {
  const dataset = data([record("2023-01-01", 1), record("2024-01-01", 2)]);
  dataset.calendar.records.push({ ...dataset.calendar.records[0] });
  assert.throws(() => compare(dataset), /Duplicate daily/);
  const mislabeled = data([
    record("2023-01-01", 1, { value_basis: "observed_modis" }),
    record("2024-01-01", 2),
  ]);
  assert.throws(() => compare(mislabeled), /incompatible value basis/);
  const unconverted = data(
    [
      record("2023-01-01", 1, {
        metric_name: "harmonized_frp_index",
        value_basis: "observed_modis",
        calibration_version: calibration,
      }),
      record("2024-01-01", 2, {
        metric_name: "harmonized_frp_index",
        calibration_version: calibration,
      }),
    ],
    true,
  );
  assert.throws(() => compare(unconverted, "harmonized"), /Unconverted MODIS/);
});

test("comparison preserves provenance and does not mutate source records or metadata", () => {
  const dataset = data([record("2023-01-01", 1), record("2024-01-01", 2)]);
  const before = JSON.stringify(dataset);
  const result = compare(dataset);
  assert.equal(result.datasetVersion, dataset.manifest.dataset_version);
  assert.equal(result.dataStatus, "fixture");
  assert.equal(result.validationStatus, "not_run");
  assert.equal(result.decision, "pending");
  assert.equal(result.coverageMethod, dataset.manifest.coverage_method);
  assert.equal(result.combinationRule, dataset.validation.combination_rule);
  assert.deepEqual(result.datasetSources, dataset.manifest.sources);
  assert.notEqual(
    result.series[0].points[0].record,
    dataset.calendar.records[1],
  );
  (result.series[0].points[0].record as ActivityAggregate).metric_value = 999;
  result.limitations.push("test-only mutation");
  result.datasetSources.push("test-only source");
  assert.equal(JSON.stringify(dataset), before);
});
