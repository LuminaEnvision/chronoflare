import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  evidenceInventory,
  keepReadingLevel,
  plainSourceLabels,
  readingLevel,
} from "./reading-level";
import { observationSources } from "./observations";

test("a visit with no calendar selection opens the overview", () => {
  assert.equal(readingLevel(""), "overview");
  assert.equal(readingLevel("?view=calendar"), "overview");
  assert.equal(
    readingLevel("?view=calendar&basis=viirs&region=pantanal-pilot"),
    "overview",
  );
});

test("every inspection link from the presentation guide opens with full scientific detail", () => {
  for (const link of [
    "?obs_source=harmonized&obs_year=2020&obs_date=2020-08-01",
    "?obs_source=harmonized&obs_year=2020&obs_compare=2024",
    "?obs_source=harmonized&obs_year=2020&obs_date=2020-08-01&obs_compare=2024",
    "?obs_source=harmonized&obs_year=2025",
    "?obs_source=harmonized&obs_year=2025&obs_date=2025-08-01",
    "?obs_source=harmonized&obs_year=2012&obs_date=2012-03-10",
    "?obs_source=harmonized&obs_year=2020&obs_date=2020-01-04",
    "?obs_year=2016",
  ])
    assert.equal(readingLevel(link), "full", link);
});

test("an explicit level always wins and unknown values are ignored", () => {
  assert.equal(readingLevel("?obs_detail=full"), "full");
  assert.equal(
    readingLevel("?obs_detail=overview&obs_year=2020&obs_date=2020-08-01"),
    "overview",
  );
  assert.equal(readingLevel("?obs_detail=expert"), "overview");
  assert.equal(readingLevel("?obs_detail=expert&obs_year=2020"), "full");
});

test("selecting something in the overview does not switch layouts", () => {
  const picked = new URLSearchParams("obs_date=2020-09-10");
  keepReadingLevel("", picked);
  assert.equal(picked.get("obs_detail"), "overview");
  assert.equal(readingLevel(`?${picked}`), "overview");
  const inspecting = new URLSearchParams("obs_year=2020&obs_date=2020-09-10");
  keepReadingLevel("?obs_year=2020&obs_date=2020-08-01", inspecting);
  assert.equal(inspecting.has("obs_detail"), false);
  const chosen = new URLSearchParams("obs_detail=full&obs_date=2020-09-10");
  keepReadingLevel("?obs_detail=overview", chosen);
  assert.equal(chosen.get("obs_detail"), "full");
});

test("plain series names keep the technical name beside them", () => {
  assert.deepEqual(
    Object.keys(plainSourceLabels).sort(),
    [...observationSources].sort(),
  );
  assert.match(plainSourceLabels.snpp, /VIIRS.*Suomi-NPP/);
  assert.match(plainSourceLabels.terra, /MODIS.*Terra/);
  assert.match(plainSourceLabels.aqua, /MODIS.*Aqua/);
});

test("every piece of evaluator-facing information is still marked in the calendar", () => {
  const source = readFileSync(
    new URL("../components/ObservationCalendar.tsx", import.meta.url),
    "utf8",
  );
  const ids = evidenceInventory.map(([id]) => id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids)
    assert.ok(
      source.includes(`data-evidence="${id}"`),
      `missing evidence block: ${id}`,
    );
  // The registered wording an evaluator checks against must not be reworded.
  for (const phrase of [
    "Plan A · approved v2",
    "both MODIS platforms complete",
    "no independent backward test",
    "Dates in the training period are not validation evidence.",
    "S-NPP observed, same solar date",
    "Uncalibrated MODIS benchmark",
    "Empirical 80% interval",
    "Fixed regional solar reference UTC−03:46:36",
    "Beyond training range",
  ])
    assert.ok(source.includes(phrase), `missing registered wording: ${phrase}`);
});
