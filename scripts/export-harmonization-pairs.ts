import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";

// Presentation transformation only: it copies approved estimates beside their
// S-NPP reference and native benchmark for the app. It fits and scores nothing,
// and it refuses to write unless every value reconciles with the published
// observation export.
const root = new URL("../", import.meta.url);
async function read(path: string) {
  const bytes = await readFile(new URL(path, root));
  return {
    data: JSON.parse(bytes.toString()),
    path,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}
const close = (a: number, b: number) =>
  Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
const series = await read(
  "docs/multiyear-evidence/harmonized-series/pantanal-harmonized-daily-v2.json",
);
const manifest = await read("app/public/data/observations/v1/manifest.json");
if (
  series.data.status !== "approved_plan_a" ||
  manifest.data.approval?.decision !== "plan_a" ||
  manifest.data.approval.model_sha256 !== series.data.model.frozen_models_sha256
)
  throw new Error("Approved model identity mismatch");
const weights = series.data.model.weights as { Terra: number; Aqua: number };
if (!close(weights.Terra + weights.Aqua, 1))
  throw new Error("Weights are not convex");
const published = new Map<string, any>();
for (const asset of manifest.data.years) {
  const year = await read(`app/public/data/observations/v1/${asset.year}.json`);
  if (year.sha256 !== asset.sha256)
    throw new Error("Observation asset integrity mismatch");
  for (const day of year.data.days) published.set(day.date, day);
}
const rows = series.data.daily.map((row: any) => {
  const day = published.get(row.solar_date);
  const h = day?.harmonized;
  if (
    !h ||
    h.value_mw !== row.harmonized_frp_mw ||
    h.lower_mw !== row.interval_80_lower_mw ||
    h.upper_mw !== row.interval_80_upper_mw ||
    h.is_extrapolated !== row.is_extrapolated
  )
    throw new Error(`Estimate does not reconcile on ${row.solar_date}`);
  const snpp =
    day.snpp.day && day.snpp.night
      ? day.snpp.day.frp_mw + day.snpp.night.frp_mw
      : null;
  if (
    (snpp === null) !== (row.snpp_observed_frp_mw === null) ||
    (snpp !== null && !close(snpp, row.snpp_observed_frp_mw))
  )
    throw new Error(`S-NPP reference does not reconcile on ${row.solar_date}`);
  const i = h.inputs;
  const benchmark =
    weights.Terra * (i.terra_day_mw + i.terra_night_mw) +
    weights.Aqua * (i.aqua_day_mw + i.aqua_night_mw);
  if (!close(benchmark, row.native_weighted_modis_frp_mw))
    throw new Error(`Benchmark does not reconcile on ${row.solar_date}`);
  return {
    date: row.solar_date,
    estimate_mw: row.harmonized_frp_mw,
    lower_mw: row.interval_80_lower_mw,
    upper_mw: row.interval_80_upper_mw,
    snpp_mw: row.snpp_observed_frp_mw,
    benchmark_mw: row.native_weighted_modis_frp_mw,
    role: row.sample_role,
    extrapolated: row.is_extrapolated,
  };
});
const estimates = [...published.values()].filter((d) => d.harmonized).length;
if (
  rows.length !== estimates ||
  rows.length !== series.data.coverage.exported_days
)
  throw new Error("Published estimate count does not reconcile");
const output = {
  schema_version: "harmonization-pairs/1.0.0",
  model_sha256: series.data.model.frozen_models_sha256,
  weights,
  provenance: [
    { path: series.path, sha256: series.sha256 },
    { path: manifest.path, sha256: manifest.sha256 },
  ],
  rows,
};
const target = new URL("app/public/data/harmonization-pairs.json", root);
await mkdir(new URL(".", target), { recursive: true });
await writeFile(target, JSON.stringify(output) + "\n");
console.log(
  `Exported ${rows.length} reconciled presentation rows without fitting or scoring any model.`,
);
