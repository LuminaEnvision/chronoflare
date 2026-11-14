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
test("fixture válida mantém harmonização bloqueada e anos bissextos completos", () => {
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
test("ausência não pode virar zero; zero exige cobertura adequada", () => {
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
test("extrapolação exige estimativa e estimativa exige intervalo", () => {
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
test("versões divergentes bloqueiam interpretação", () => {
  assert.throws(
    () =>
      parseDataset(
        manifest,
        { ...calendar, dataset_version: "other" },
        validation,
      ),
    /Versões/,
  );
  const records = [{ ...example, dataset_version: "other" }];
  assert.throws(
    () => parseDataset(manifest, { ...calendar, records }, validation),
    /Versões/,
  );
});
test("status não realizado nunca aprova harmonização", () => {
  assert.throws(
    () =>
      parseDataset(
        { ...manifest, harmonization_approved: true, decision: "plan_a" },
        calendar,
        { ...validation, decision: "plan_a" },
      ),
    /aprovação/,
  );
});
test("plano B aceita bases originais e bloqueia estimativas", () => {
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
    /Estimativas bloqueadas/,
  );
});
test("plano A exige evidências antes de liberar a série", () => {
  assert.throws(
    () =>
      parseDataset(
        { ...manifest, decision: "plan_a", harmonization_approved: true },
        calendar,
        { ...validation, status: "passed", decision: "plan_a" },
      ),
    /evidências/,
  );
});
test("dados reais exigem período e proveniência", () => {
  assert.throws(
    () =>
      parseDataset({ ...manifest, data_status: "real" }, calendar, validation),
    /proveniência/,
  );
});
test("duplicação e região inconsistente bloqueiam dataset", () => {
  assert.throws(
    () =>
      parseDataset(
        manifest,
        { ...calendar, records: [example, example] },
        validation,
      ),
    /duplicado/,
  );
  assert.throws(
    () =>
      parseDataset(manifest, { ...calendar, region_id: "other" }, validation),
    /Região/,
  );
});
test("29 de fevereiro não desloca março nos demais anos", () => {
  assert.equal(calendarSlot("2024-02-29"), 59);
  assert.equal(calendarSlot("2023-03-01"), 60);
  assert.equal(calendarSlot("2024-03-01"), 60);
  assert.equal(calendarSlot("2025-12-31"), 365);
});
test("datas impossíveis e intervalo invertido são rejeitados", () => {
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

test("plano A mantém originais e harmonizada sem colisão de identidade", () => {
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
