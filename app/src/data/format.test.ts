import { test } from "node:test";
import assert from "node:assert/strict";
import { formatCoverageMethod, formatDate, formatMetric } from "./format";

test("metric labels use English numeric formatting and missing-value text", () => {
  assert.equal(formatMetric(null), "Not available");
  assert.equal(formatMetric(1234.5), "1,234.5");
  assert.equal(formatMetric(0), "0");
});

test("dates use English month names and preserve the selected UTC day", () => {
  assert.equal(formatDate("2024-02-29"), "February 29, 2024");
  assert.equal(formatDate("2025-09-01"), "September 1, 2025");
});

test("coverage labels explain pending states without claiming approval", () => {
  assert.equal(
    formatCoverageMethod("pending_scientific_review"),
    "Awaiting scientific review",
  );
  assert.equal(formatCoverageMethod("unknown"), "Coverage not established");
  assert.equal(
    formatCoverageMethod("undetermined"),
    "Coverage not established",
  );
  assert.equal(formatCoverageMethod(""), "Not specified");
});

test("unknown coverage identifiers point to the manifest instead of implying adequate coverage", () => {
  for (const method of [
    "future_method_v2",
    "__proto__",
    "orbital_swath_availability_proxy (cloud_uncorrected)",
  ]) {
    assert.equal(formatCoverageMethod(method), "See dataset manifest");
  }
});
