import test from "node:test";
import assert from "node:assert/strict";
import { confidenceLabel } from "./confidence-label";
import { calendarFocusTarget } from "./observations";
test("month-row keyboard movement preserves real dates and year boundaries", () => {
  assert.equal(calendarFocusTarget("2024-01-31", "ArrowDown"), "2024-02-29");
  assert.equal(calendarFocusTarget("2025-01-31", "ArrowDown"), "2025-02-28");
  assert.equal(calendarFocusTarget("2024-03-31", "ArrowUp"), "2024-02-29");
  assert.equal(calendarFocusTarget("2024-02-29", "ArrowRight"), "2024-03-01");
  assert.equal(calendarFocusTarget("2024-01-01", "ArrowLeft"), "2024-01-01");
  assert.equal(calendarFocusTarget("2024-12-31", "ArrowDown"), "2024-12-31");
  assert.equal(calendarFocusTarget("2024-08-14", "Home"), "2024-08-01");
  assert.equal(calendarFocusTarget("2024-08-14", "End"), "2024-08-31");
  assert.equal(calendarFocusTarget("2025-02-29", "ArrowRight"), null);
  assert.equal(calendarFocusTarget("2024-08-14", "Tab"), null);
});
test("confidence labels preserve the raw code and respect source-class boundaries", () => {
  assert.equal(confidenceLabel("n"), "Nominal (n)");
  assert.equal(confidenceLabel("h"), "High (h)");
  assert.equal(confidenceLabel("l"), "Low (l)");
  assert.equal(confidenceLabel(29), "Low (29/100)");
  assert.equal(confidenceLabel(30), "Nominal (30/100)");
  assert.equal(confidenceLabel(80), "High (80/100)");
  assert.equal(confidenceLabel(""), "Not supplied");
  assert.equal(confidenceLabel("x"), "Unrecognized (x)");
});
