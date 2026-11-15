import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const root = new URL("../", import.meta.url);
async function evidence(path: string) {
  const bytes = await readFile(new URL(path, root));
  return {
    data: JSON.parse(bytes.toString()),
    path,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}
const v1 = await evidence("docs/multiyear-evidence/experiment-summary.json");
const v2 = await evidence(
  "docs/multiyear-evidence/v2-candidate/independent-summary-v2.json",
);
const model = await evidence(
  "docs/multiyear-evidence/v2-candidate/frozen-models-v2.json",
);
if (
  model.sha256 !== v2.data.frozen_models_sha256 ||
  !v2.data.independent_validation ||
  v2.data.evaluation_kind !==
    "independent_holdout_registered_before_acquisition"
)
  throw new Error("Independent evidence identity mismatch");
const series = await evidence(
  "docs/multiyear-evidence/harmonized-series/pantanal-harmonized-daily-v2.json",
);
if (
  series.data.model.frozen_models_sha256 !== model.sha256 ||
  series.data.status !== "approved_plan_a"
)
  throw new Error("Publication evidence model mismatch");
const rolesByDate: Record<string, string> = {};
for (const day of series.data.daily) {
  if (rolesByDate[day.solar_date])
    throw new Error("Duplicate publication date");
  rolesByDate[day.solar_date] = day.sample_role;
}
const compact = (m: any) => ({
  paired_days: m.paired_daily_count,
  weekly: m.weekly_metrics,
  naive: m.naive_weekly_metrics_same_cohort,
  picp_daily: m.picp_daily,
  median_relative_width: m.median_relative_interval_width,
  checks: m.checks,
});
const primary =
  v2.data.empirical_metrics.forward_validation_primary.Combined_Terra_Aqua;
const perYear: Record<string, number> = {};
for (const day of primary.paired_dates)
  perYear[day.slice(0, 4)] = (perYear[day.slice(0, 4)] ?? 0) + 1;
if (
  !v2.data.all_registered_forward_combined_checks_met ||
  !Object.values(primary.checks).every(Boolean)
)
  throw new Error("Registered checks did not pass");
const output = {
  schema_version: "research-evidence/1.0.0",
  v1: {
    model_sha256: v1.data.frozen_models_sha256,
    decision: v1.data.decision,
    combined_forward: compact(
      v1.data.empirical_metrics.forward_validation_primary.Combined_Terra_Aqua,
    ),
  },
  v2: {
    model_sha256: model.sha256,
    evaluation_kind: v2.data.evaluation_kind,
    registered_at_utc: v2.data.registration.registered_at_utc,
    completed_blocks: v2.data.completed_blocks.length,
    missing_blocks: v2.data.missing_blocks.length,
    combined_forward: compact(primary),
    paired_days_by_year: perYear,
    independent_backward_validation: false,
  },
  publication: {
    total_days: series.data.coverage.exported_days,
    by_year: series.data.coverage.exported_days_by_year,
    by_sample_role: series.data.coverage.exported_days_by_sample_role,
    extrapolated_days: series.data.coverage.extrapolated_days,
    roles_by_date: rolesByDate,
  },
  provenance: [
    { path: v1.path, sha256: v1.sha256 },
    { path: v2.path, sha256: v2.sha256 },
    { path: series.path, sha256: series.sha256 },
  ],
};
const target = new URL("app/public/data/research-summary.json", root);
await mkdir(new URL(".", target), { recursive: true });
await writeFile(target, JSON.stringify(output, null, 2) + "\n");
console.log(
  "Exported compact research evidence without fitting or scoring any model.",
);
