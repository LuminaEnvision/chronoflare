import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  approvedModelHash,
  isCivilDate,
  loadObservationYear,
  observationManifestSchema,
  observationSelection,
  observationYearSchema,
  readingFor,
  validateObservationYear,
  yearDates,
} from "./observations";
import { researchEvidenceSchema } from "./research-evidence";
import { readFileSync } from "node:fs";

const turn = { frp_mw: 10, count: 1 };
const platform = { day: turn, night: turn };
function yearData() {
  return {
    schema_version: "chronoflare-observation-year/1.0.0",
    year: 2020,
    days: [
      {
        date: "2020-08-01",
        terra: platform,
        aqua: platform,
        snpp: { day: turn, night: null },
        harmonized: null,
      },
      {
        date: "2020-08-02",
        terra: platform,
        aqua: platform,
        snpp: { day: null, night: null },
        harmonized: {
          value_mw: 25,
          lower_mw: 15,
          upper_mw: 45,
          is_extrapolated: false,
          regime: "Terra+Aqua_weighted",
          inputs: {
            terra_day_mw: 10,
            terra_night_mw: 10,
            aqua_day_mw: 10,
            aqua_night_mw: 10,
            terra_night_source_date: "2020-08-01",
          },
        },
      },
    ],
  };
}
function manifestData() {
  return {
    schema_version: "chronoflare-observations/1.0.0",
    region_id: "pantanal_ibge_2025_reference",
    region_name: "Brazilian Pantanal",
    solar_offset_seconds: -13596,
    coverage_status: "unknown",
    quality_rule_version: "indicator-sp-quality/1.0.0",
    dedup_rule_version: "indicator-exact-key/python-float64-round-1.1.0",
    source_observation_sha256: ["a".repeat(64)],
    approval: {
      decision: "plan_a",
      reviewed_by: "Scientific owner",
      scope: "both_complete_platforms",
      model_sha256: approvedModelHash,
      record_path: "docs/handoff/approval.md",
      approved_claim:
        "Both complete MODIS platforms only; sparse 2025–2026; no independent backward test.",
    },
    years: [
      {
        year: 2020,
        path: "/data/observations/v1/2020.json",
        sha256: "b".repeat(64),
        bytes: 100,
        day_count: 2,
      },
      {
        year: 2024,
        path: "/data/observations/v1/2024.json",
        sha256: "c".repeat(64),
        bytes: 100,
        day_count: 1,
      },
    ],
  };
}
test("native gaps, partial sums and no positives have distinct nonzero-inference semantics", () => {
  const data = observationYearSchema.parse(yearData());
  assert.deepEqual(readingFor(undefined, "snpp"), {
    value: null,
    count: null,
    status: "not_acquired",
  });
  assert.deepEqual(readingFor(data.days[0], "snpp"), {
    value: 10,
    count: 1,
    status: "partial_turns",
  });
  assert.deepEqual(readingFor(data.days[1], "snpp"), {
    value: null,
    count: null,
    status: "no_positive_records",
  });
  assert.equal(readingFor(data.days[0], "terra").value, 20);
  assert.equal(
    readingFor(data.days[0], "harmonized").status,
    "not_publishable",
  );
  assert.equal(readingFor(data.days[1], "harmonized").lower, 15);
});
test("dates preserve leap days without rollover and explicit valid gaps", () => {
  assert.equal(isCivilDate("2025-02-29"), false);
  assert.equal(isCivilDate("2024-02-29"), true);
  assert.equal(yearDates(2024).length, 366);
  assert.equal(yearDates(2023).length, 365);
  const manifest = observationManifestSchema.parse(manifestData());
  const selected = observationSelection(
    "?obs_year=2024&obs_date=2024-02-29&obs_source=terra&obs_compare=2020",
    manifest,
  );
  assert.deepEqual(selected, {
    year: 2024,
    date: "2024-02-29",
    source: "terra",
    compareYear: 2020,
  });
  assert.equal(
    observationSelection("?obs_year=2020&obs_date=2020-01-07", manifest).date,
    "2020-01-07",
  );
  assert.equal(
    observationSelection("?obs_year=2024&obs_compare=2024", manifest)
      .compareYear,
    null,
  );
});
test("approval binds the model, scope and safe source paths", () => {
  const input = manifestData();
  input.years[0].path = "https://example.com/2020.json";
  assert.throws(() => observationManifestSchema.parse(input));
  const unsafe = manifestData();
  unsafe.approval.record_path = "docs/../secret";
  assert.throws(() => observationManifestSchema.parse(unsafe));
  const model = manifestData();
  model.approval.model_sha256 = "a".repeat(64);
  assert.throws(() => observationManifestSchema.parse(model));
  const scope = manifestData();
  scope.approval.scope = "any_platform";
  assert.throws(() => observationManifestSchema.parse(scope));
});
test("unapproved values and wrong year/count are rejected", () => {
  const manifest = observationManifestSchema.parse(manifestData());
  assert.throws(
    () =>
      validateObservationYear(
        yearData(),
        { ...manifest, approval: null },
        2020,
      ),
    /Unapproved/,
  );
  assert.throws(
    () => validateObservationYear(yearData(), manifest, 2024),
    /manifest/,
  );
  assert.equal(
    observationSelection("?obs_source=harmonized", {
      ...manifest,
      approval: null,
    }).source,
    "snpp",
  );
});
test("aligned complete-platform inputs must match the native observations", () => {
  const data = yearData();
  data.days[1].harmonized!.inputs.terra_night_source_date = "2020-08-02";
  assert.throws(() => observationYearSchema.parse(data));
  const mismatch = yearData();
  mismatch.days[1].harmonized!.inputs.terra_night_mw = 999;
  assert.throws(() => observationYearSchema.parse(mismatch));
  const missing = yearData();
  missing.days[1].aqua = { day: turn, night: null } as any;
  assert.throws(() => observationYearSchema.parse(missing));
});
test("invalid physical values, reversed intervals, duplicate dates and nonexistent dates fail", () => {
  for (const value of [0, -1, Infinity, NaN]) {
    const data = yearData();
    data.days[0].snpp = { day: { frp_mw: value, count: 1 }, night: null };
    assert.throws(() => observationYearSchema.parse(data));
  }
  const interval = yearData();
  interval.days[1].harmonized!.lower_mw = 100;
  assert.throws(() => observationYearSchema.parse(interval));
  const duplicate = yearData();
  duplicate.days[1].date = duplicate.days[0].date;
  assert.throws(() => observationYearSchema.parse(duplicate));
  const rollover = yearData();
  rollover.days[0].date = "2020-02-30";
  assert.throws(() => observationYearSchema.parse(rollover));
});
test("year loading checks exact bytes and SHA-256 before parsing", async () => {
  const bytes = JSON.stringify(yearData());
  const manifest = observationManifestSchema.parse(manifestData());
  manifest.years[0].bytes = Buffer.byteLength(bytes);
  manifest.years[0].sha256 = createHash("sha256").update(bytes).digest("hex");
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response(bytes, { status: 200 });
    assert.equal((await loadObservationYear(manifest, 2020)).days.length, 2);
    manifest.years[0].sha256 = "a".repeat(64);
    await assert.rejects(loadObservationYear(manifest, 2020), /integrity/);
    manifest.years[0].bytes++;
    await assert.rejects(loadObservationYear(manifest, 2020), /byte count/);
  } finally {
    globalThis.fetch = original;
  }
});
test("compact research evidence reconciles independent support and preserves the historical rejection", () => {
  const input = JSON.parse(
    readFileSync(
      new URL("../../public/data/research-summary.json", import.meta.url),
      "utf8",
    ),
  );
  const data = researchEvidenceSchema.parse(input);
  assert.equal(data.v1.decision, "plan_b");
  assert.equal(data.v2.combined_forward.paired_days, 506);
  input.v2.paired_days_by_year["2026"] = 99;
  assert.throws(() => researchEvidenceSchema.parse(input));
});
