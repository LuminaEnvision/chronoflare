import { test } from "node:test";
import assert from "node:assert/strict";
import { formatDate, formatMetric } from "./format";

test("metric labels use English numeric formatting and missing-value text", () => {
  assert.equal(formatMetric(null), "Not available");
  assert.equal(formatMetric(1234.5), "1,234.5");
  assert.equal(formatMetric(0), "0");
});

test("dates use English month names and preserve the selected UTC day", () => {
  assert.equal(formatDate("2024-02-29"), "February 29, 2024");
  assert.equal(formatDate("2025-09-01"), "September 1, 2025");
});
