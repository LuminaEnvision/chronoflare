import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { niceCeiling } from "./chart-scale";
import {
  missingYears,
  observationIssues,
  observationManifestSchema,
} from "./observations";

const manifest = observationManifestSchema.parse(
  JSON.parse(
    readFileSync(
      new URL(
        "../../public/data/observations/v1/manifest.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ),
);

test("a valid or empty link produces no notice", () => {
  assert.deepEqual(observationIssues("", manifest), []);
  assert.deepEqual(
    observationIssues(
      "?obs_source=harmonized&obs_year=2020&obs_date=2020-08-01&obs_compare=2024",
      manifest,
    ),
    [],
  );
  assert.deepEqual(observationIssues("?obs_compare=", manifest), []);
});

test("requests the calendar cannot honor are explained instead of silently replaced", () => {
  const year = observationIssues("?obs_year=2016", manifest);
  assert.equal(year.length, 1);
  assert.match(year[0], /2016 was not acquired, so 2020 is shown/);
  assert.match(year[0], /not a year without fire/);
  assert.match(observationIssues("?obs_year=abc", manifest)[0], /not valid/);
  assert.match(
    observationIssues("?obs_year=2020&obs_date=2021-02-30", manifest)[0],
    /not a day of 2020, so 2020-01-01 is shown/,
  );
  assert.match(
    observationIssues("?obs_source=nope", manifest)[0],
    /series is not available, so Harmonized/,
  );
  assert.match(
    observationIssues("?obs_year=2020&obs_compare=2016", manifest)[0],
    /2016 was not acquired, so no comparison/,
  );
  assert.match(
    observationIssues("?obs_year=2020&obs_compare=2020", manifest)[0],
    /cannot be compared with itself/,
  );
  assert.equal(
    observationIssues("?obs_year=2016&obs_source=nope&obs_date=x", manifest)
      .length,
    3,
  );
});

test("years missing inside the acquired range are reported from the manifest", () => {
  assert.deepEqual(missingYears(manifest), [2016]);
});

test("axis maxima round up to readable values and never cut data off", () => {
  assert.equal(niceCeiling(193924.05), 200000);
  assert.equal(niceCeiling(96962), 100000);
  assert.equal(niceCeiling(2100), 2500);
  assert.equal(niceCeiling(26000), 50000);
  assert.equal(niceCeiling(5000), 5000);
  assert.equal(niceCeiling(0.3), 0.5);
  assert.equal(niceCeiling(0), 1);
  assert.equal(niceCeiling(Number.NaN), 1);
  for (const value of [1, 7, 42, 999, 1001, 31857.9, 318578.6])
    assert.ok(niceCeiling(value) >= value && niceCeiling(value) <= value * 2.5);
});
