import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { frpColor, frpIntensity, frpScaleTicks, luminance } from "./frp-color";
import {
  harmonizationPairsSchema,
  logDomain,
  logPosition,
  pairedRows,
  roleCounts,
} from "./harmonization-pairs";
import { observationYearSchema } from "./observations";
import { researchEvidenceSchema } from "./research-evidence";

const read = (path: string) =>
  JSON.parse(
    readFileSync(new URL(`../../public/data/${path}`, import.meta.url), "utf8"),
  );
const pairs = harmonizationPairsSchema.parse(read("harmonization-pairs.json"));

test("the color scale is one hue that darkens steadily and saturates at its maximum", () => {
  const steps = [0.5, ...frpScaleTicks, 1e6].map((v) => luminance(frpColor(v)));
  for (let i = 1; i < steps.length - 1; i++) assert.ok(steps[i] < steps[i - 1]);
  assert.equal(frpColor(1e6), frpColor(100000));
  assert.equal(frpIntensity(0), 0);
  assert.equal(frpIntensity(Number.NaN), 0);
  // Neighbouring legend steps must be clearly different in lightness.
  const ticks = frpScaleTicks.map((v) => luminance(frpColor(v)));
  for (let i = 1; i < ticks.length; i++)
    assert.ok(ticks[i - 1] / ticks[i] > 1.25);
});

test("presentation rows reconcile with the published observations and evidence summary", () => {
  const evidence = researchEvidenceSchema.parse(read("research-summary.json"));
  assert.equal(pairs.rows.length, evidence.publication.total_days);
  for (const row of pairs.rows)
    assert.equal(row.role, evidence.publication.roles_by_date[row.date]);
  assert.equal(
    pairs.rows.filter((r) => r.extrapolated).length,
    evidence.publication.extrapolated_days,
  );
  const byDate = new Map(pairs.rows.map((r) => [r.date, r]));
  let estimates = 0;
  for (const year of new Set(pairs.rows.map((r) => r.date.slice(0, 4)))) {
    for (const day of observationYearSchema.parse(
      read(`observations/v1/${year}.json`),
    ).days) {
      const row = byDate.get(day.date);
      assert.equal(!!day.harmonized, !!row);
      if (!day.harmonized || !row) continue;
      estimates++;
      assert.equal(row.estimate_mw, day.harmonized.value_mw);
      assert.equal(row.lower_mw, day.harmonized.lower_mw);
      assert.equal(row.upper_mw, day.harmonized.upper_mw);
      const reference =
        day.snpp.day && day.snpp.night
          ? day.snpp.day.frp_mw + day.snpp.night.frp_mw
          : null;
      if (reference === null) assert.equal(row.snpp_mw, null);
      else assert.ok(Math.abs(reference - row.snpp_mw!) < 1e-6);
      const i = day.harmonized.inputs;
      const benchmark =
        pairs.weights.Terra * (i.terra_day_mw + i.terra_night_mw) +
        pairs.weights.Aqua * (i.aqua_day_mw + i.aqua_night_mw);
      assert.ok(Math.abs(benchmark - row.benchmark_mw) < 1e-6 * benchmark);
    }
  }
  assert.equal(estimates, pairs.rows.length);
});

test("only dates with an S-NPP reference are compared and missing references stay unavailable", () => {
  const paired = pairedRows(pairs.rows);
  assert.ok(paired.every((r) => r.snpp_mw !== null));
  const counts = roleCounts(pairs.rows);
  assert.equal(
    counts.reduce((sum, c) => sum + c.published, 0),
    pairs.rows.length,
  );
  assert.equal(
    counts.reduce((sum, c) => sum + c.paired, 0),
    paired.length,
  );
  assert.equal(
    counts.reduce((sum, c) => sum + c.withoutReference, 0),
    pairs.rows.filter((r) => r.snpp_mw === null).length,
  );
  assert.ok(counts.every((c) => c.published > 0));
});

test("log axes cover every plotted value with whole powers of ten", () => {
  assert.deepEqual(logDomain([41.6, 318578]), { low: 1, high: 6 });
  assert.deepEqual(logDomain([100]), { low: 2, high: 3 });
  assert.throws(() => logDomain([0, -1, Number.NaN]));
  assert.equal(logPosition(1000, { low: 1, high: 5 }), 0.5);
  const all = pairedRows(pairs.rows).flatMap((r) => [
    r.estimate_mw,
    r.snpp_mw,
    r.benchmark_mw,
    r.upper_mw,
    Math.max(r.lower_mw, 1),
  ]);
  const domain = logDomain(all);
  for (const v of all) {
    const p = logPosition(v, domain);
    assert.ok(p >= 0 && p <= 1);
  }
});

test("rejects malformed presentation data", () => {
  const base = read("harmonization-pairs.json");
  assert.throws(() =>
    harmonizationPairsSchema.parse({ ...base, model_sha256: "0".repeat(64) }),
  );
  assert.throws(() =>
    harmonizationPairsSchema.parse({
      ...base,
      rows: [base.rows[1], base.rows[0]],
    }),
  );
  assert.throws(() =>
    harmonizationPairsSchema.parse({
      ...base,
      rows: [{ ...base.rows[0], lower_mw: base.rows[0].upper_mw + 1 }],
    }),
  );
  assert.throws(() =>
    harmonizationPairsSchema.parse({
      ...base,
      weights: { Terra: 0.5, Aqua: 0.6 },
    }),
  );
});
