import { mkdir, writeFile } from "node:fs/promises";
import { parseDataset, type ActivityAggregate } from "../app/src/data/schema";
const version = "fixture-0.1.1";
const records: ActivityAggregate[] = [];
for (let year = 2012; year <= 2025; year++)
  for (const sensor of ["modis", "viirs"] as const) {
    for (
      let time = Date.UTC(year, 0, 1), day = 0;
      time < Date.UTC(year + 1, 0, 1);
      time += 86400000, day++
    ) {
      const missing = (day + year) % 37 === 0,
        partial = !missing && (day + year) % 29 === 0;
      const value = missing
        ? null
        : Math.round(
            (Math.max(0, Math.sin(((day - 165) / 365) * Math.PI * 2)) ** 4 *
              240 *
              (0.6 + (year % 5) / 5) +
              (day % 11)) *
              (sensor === "modis" ? 0.58 : 1),
          );
      records.push({
        region_id: "pantanal-pilot",
        cell_id: null,
        period_start: new Date(time).toISOString().slice(0, 10),
        period_end: new Date(time + 86400000).toISOString().slice(0, 10),
        temporal_resolution: "day",
        spatial_resolution: "aoi",
        metric_name: `${sensor}_frp_sum`,
        metric_value: value,
        value_basis: sensor === "modis" ? "observed_modis" : "observed_viirs",
        uncertainty_lower: null,
        uncertainty_upper: null,
        interval_level: null,
        modis_frp_sum: sensor === "modis" ? value : null,
        viirs_frp_sum: sensor === "viirs" ? value : null,
        modis_detection_count: null,
        viirs_detection_count: null,
        coverage_flag: missing
          ? "no_data"
          : partial && value !== 0
            ? "partial"
            : "ok",
        coverage_fraction: missing ? null : partial && value !== 0 ? 0.5 : 1,
        baseline_median: null,
        baseline_p10: null,
        baseline_p90: null,
        baseline_n_years: 0,
        percentile_rank: null,
        robust_z: null,
        is_unusual: false,
        calibration_version: null,
        methodology_version: "1.2",
        dataset_version: version,
        is_extrapolated: false,
        estimation_method: null,
        calibration_stratum: null,
        overpass_count: null,
      });
    }
  }
const manifest = {
  schema_version: "1.0.0",
  dataset_version: version,
  methodology_version: "1.2",
  generated_at_utc: null,
  data_status: "fixture",
  decision: "pending",
  harmonization_approved: false,
  region_ids: ["pantanal-pilot"],
  sources: ["MODIS", "VIIRS"],
  actual_date_range: null,
  coverage_method: "pending_scientific_review",
  files: {
    calendar_day: "/data/v1/regions/pantanal-pilot/calendar/day.json",
    validation: "/data/v1/validation/summary.json",
  },
};
const calendar = {
  region_id: "pantanal-pilot",
  resolution: "day",
  basis: "separate",
  dataset_version: version,
  calibration_version: null,
  coverage_method: manifest.coverage_method,
  records,
};
const validation = {
  status: "not_run",
  dataset_version: version,
  decision: "pending",
  thresholds_registered_at: null,
  thresholds: null,
  training_period: null,
  test_period: null,
  results_by_platform: [],
  combination_rule: "pending_scientific_review",
  coverage_method: manifest.coverage_method,
  pre2012_notice:
    "Estimates before 2012 are extrapolations without direct validation against VIIRS.",
  limitations: [
    "Entirely synthetic data; no scientific results have been calculated.",
    "The Pantanal AOI still requires confirmation from André.",
  ],
  calibration_version: null,
};
parseDataset(manifest, calendar, validation);
for (const [path, value] of Object.entries({
  "manifest.json": manifest,
  "regions/pantanal-pilot/calendar/day.json": calendar,
  "validation/summary.json": validation,
})) {
  const dest = "app/public/data/v1/" + path;
  await mkdir(dest.slice(0, dest.lastIndexOf("/")), { recursive: true });
  await writeFile(dest, JSON.stringify(value));
}
console.log("Deterministic fixtures generated and validated.");
