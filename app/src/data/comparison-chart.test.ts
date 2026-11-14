import { test } from "node:test";
import assert from "node:assert/strict";
import { comparisonAxis } from "./annual-comparison";
import type { ComparisonPoint, ComparisonSegment } from "./annual-comparison";
import {
  describePoint,
  FEBRUARY_29_SLOT,
  segmentDash,
  segmentPath,
  singletonValue,
  valueToY,
} from "./comparison-chart";

const point = (
  slot: number,
  value: number | null,
  status: ComparisonPoint["status"] = "available",
): ComparisonPoint => ({
  slot,
  monthDay: comparisonAxis[slot].monthDay,
  date:
    status === "not_in_year" ? null : `2024-${comparisonAxis[slot].monthDay}`,
  value,
  status,
  record:
    value === null
      ? null
      : ({
          metric_value: value,
          value_basis: "observed_viirs",
          is_extrapolated: false,
          coverage_flag: status === "partial" ? "partial" : "ok",
        } as ComparisonPoint["record"]),
});

test("February 29 stays on slot 59 and March 1 stays on slot 60", () => {
  assert.equal(comparisonAxis[FEBRUARY_29_SLOT].monthDay, "02-29");
  assert.equal(comparisonAxis[60].monthDay, "03-01");
});

test("both years share one vertical scale and a constant zero stays on one line", () => {
  const extent = { min: 0, max: 100 };
  assert.ok(valueToY(100, extent, 10, 110) < valueToY(0, extent, 10, 110));
  assert.equal(valueToY(0, { min: 0, max: 0 }, 10, 110), 60);
});

test("a segment path does not cross a gap or a coverage change", () => {
  const points = [
    point(0, 10),
    point(1, null, "no_data"),
    point(2, 30, "partial"),
  ];
  const first: ComparisonSegment = {
    startSlot: 0,
    endSlot: 0,
    status: "available",
    valueBasis: "observed_viirs",
    isExtrapolated: false,
  };
  const second: ComparisonSegment = {
    ...first,
    startSlot: 2,
    endSlot: 2,
    status: "partial",
  };
  const path = segmentPath(
    points,
    first,
    (slot) => slot * 10,
    (value) => value,
  );
  assert.equal(path.includes("L"), false);
  assert.equal(
    segmentPath(
      points,
      second,
      (slot) => slot * 10,
      (value) => value,
    ).startsWith("M20"),
    true,
  );
});

test("a one-day nonzero segment keeps a marker and does not draw a line", () => {
  const points = [point(4, 12), point(5, null, "no_data"), point(6, 0)];
  const alone: ComparisonSegment = {
    startSlot: 4,
    endSlot: 4,
    status: "available",
    valueBasis: "observed_viirs",
    isExtrapolated: false,
  };
  const path = segmentPath(
    points,
    alone,
    (slot) => slot * 10,
    (value) => value,
  );
  assert.equal(path.includes("L"), false);
  assert.equal(singletonValue(points, alone), 12);
  assert.equal(
    singletonValue(points, { ...alone, startSlot: 6, endSlot: 6 }),
    null,
  );
  assert.equal(
    singletonValue(points, { ...alone, startSlot: 4, endSlot: 6 }),
    null,
  );
  const partial: ComparisonSegment = { ...alone, status: "partial" };
  assert.equal(segmentDash(partial, ""), "2 2");
  assert.equal(segmentDash(partial, "7 4"), "7 2 2 2");
});

test("zero stays distinct from missing data in the inspection text", () => {
  const zero = describePoint(point(0, 0), "viirs", "MW");
  const missing = describePoint(
    point(1, null, "missing_record"),
    "viirs",
    "MW",
  );
  assert.match(zero, /Measured zero/);
  assert.match(zero, /0 MW/);
  assert.match(missing, /Missing record/);
  assert.match(missing, /not zero/);
  assert.equal(missing.includes("Measured zero"), false);
});
