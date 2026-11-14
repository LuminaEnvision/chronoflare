import { z } from "zod";
const nullable = z.number().finite().nullable();
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !Number.isNaN(Date.parse(v)) &&
      new Date(v).toISOString().slice(0, 10) === v,
    "Data inválida",
  );
export const aggregateSchema = z
  .object({
    region_id: z.string(),
    cell_id: z.string().nullable(),
    period_start: date,
    period_end: date,
    temporal_resolution: z.enum(["day", "week", "month"]),
    spatial_resolution: z.union([
      z.literal("aoi"),
      z.number().int().min(0).max(15),
    ]),
    metric_name: z.string(),
    metric_value: nullable,
    value_basis: z.enum([
      "observed_modis",
      "observed_viirs",
      "observed_both",
      "estimated_from_modis",
    ]),
    uncertainty_lower: nullable,
    uncertainty_upper: nullable,
    interval_level: z.number().min(0).max(1).nullable(),
    modis_frp_sum: nullable,
    viirs_frp_sum: nullable,
    modis_detection_count: z.number().int().nonnegative().nullable(),
    viirs_detection_count: z.number().int().nonnegative().nullable(),
    coverage_flag: z.enum(["ok", "partial", "no_data"]),
    coverage_fraction: z.number().min(0).max(1).nullable(),
    baseline_median: nullable,
    baseline_p10: nullable,
    baseline_p90: nullable,
    baseline_n_years: z.number().int().nonnegative(),
    percentile_rank: z.number().min(0).max(1).nullable(),
    robust_z: nullable,
    is_unusual: z.boolean(),
    calibration_version: z.string().nullable(),
    methodology_version: z.string(),
    dataset_version: z.string(),
    is_extrapolated: z.boolean(),
    estimation_method: z.enum(["ratio", "quantile_map", "gbm"]).nullable(),
    calibration_stratum: z.string().nullable(),
    overpass_count: z.number().int().nonnegative().nullable(),
  })
  .superRefine((r, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: "custom", message });
    if (r.period_end <= r.period_start)
      fail("Período deve ter fim exclusivo posterior ao início");
    if (r.coverage_flag === "no_data" && r.metric_value !== null)
      fail("Ausência deve ter valor nulo");
    if (r.metric_value === 0 && r.coverage_flag !== "ok")
      fail("Zero exige cobertura adequada");
    if (r.metric_value !== null && r.metric_value < 0)
      fail("FRP não pode ser negativa");
    if (r.is_extrapolated && r.value_basis !== "estimated_from_modis")
      fail("Extrapolação exige estimativa");
    if (
      r.value_basis === "estimated_from_modis" &&
      (r.uncertainty_lower === null ||
        r.uncertainty_upper === null ||
        r.interval_level === null)
    )
      fail("Estimativa exige intervalo");
    if (
      r.uncertainty_lower !== null &&
      r.uncertainty_upper !== null &&
      r.uncertainty_lower > r.uncertainty_upper
    )
      fail("Intervalo invertido");
  });
export const manifestSchema = z.object({
  schema_version: z.literal("1.0.0"),
  dataset_version: z.string(),
  methodology_version: z.string(),
  generated_at_utc: z.string().nullable(),
  data_status: z.enum(["fixture", "real"]),
  decision: z.enum(["pending", "plan_a", "plan_b"]),
  harmonization_approved: z.boolean(),
  region_ids: z.array(z.string()).min(1),
  sources: z.array(z.string()),
  actual_date_range: z.object({ start: date, end: date }).nullable(),
  coverage_method: z.string(),
  files: z.object({ calendar_day: z.string(), validation: z.string() }),
});
export const calendarSchema = z.object({
  region_id: z.string(),
  resolution: z.literal("day"),
  basis: z.enum(["modis", "viirs", "harmonized", "separate"]),
  dataset_version: z.string(),
  calibration_version: z.string().nullable(),
  coverage_method: z.string(),
  records: z.array(aggregateSchema).min(1),
});
export const validationSchema = z.object({
  status: z.enum(["passed", "failed", "not_run"]),
  dataset_version: z.string(),
  decision: z.enum(["pending", "plan_a", "plan_b"]),
  thresholds_registered_at: z.string().nullable(),
  thresholds: z.record(z.string(), z.unknown()).nullable(),
  training_period: z.unknown(),
  test_period: z.unknown(),
  results_by_platform: z.array(z.unknown()),
  combination_rule: z.string(),
  coverage_method: z.string(),
  pre2012_notice: z.string(),
  limitations: z.array(z.string()),
  calibration_version: z.string().nullable(),
});
export type ActivityAggregate = z.infer<typeof aggregateSchema>;
export type Dataset = ReturnType<typeof parseDataset>;
export function parseDataset(
  manifest: unknown,
  calendar: unknown,
  validation: unknown,
) {
  const m = manifestSchema.parse(manifest),
    c = calendarSchema.parse(calendar),
    v = validationSchema.parse(validation);
  if (
    c.dataset_version !== m.dataset_version ||
    v.dataset_version !== m.dataset_version ||
    c.records.some(
      (r) =>
        r.dataset_version !== m.dataset_version ||
        r.methodology_version !== m.methodology_version,
    )
  )
    throw Error("Versões de dados divergentes");
  if (
    !m.region_ids.includes(c.region_id) ||
    c.records.some((r) => r.region_id !== c.region_id)
  )
    throw Error("Região divergente");
  if (
    v.decision !== m.decision ||
    c.coverage_method !== m.coverage_method ||
    v.coverage_method !== m.coverage_method
  )
    throw Error("Manifesto e relatório inconsistentes");
  const approved =
    m.harmonization_approved &&
    m.decision === "plan_a" &&
    v.status === "passed";
  if (
    m.harmonization_approved !== approved ||
    (m.decision === "plan_a" && !approved)
  )
    throw Error("Harmonização sem aprovação válida");
  if (
    c.records.some(
      (r) =>
        r.value_basis === "estimated_from_modis" ||
        r.metric_name === "harmonized_frp_index",
    ) &&
    !approved
  )
    throw Error("Estimativas bloqueadas até aprovação");
  if (
    approved &&
    (!v.thresholds_registered_at ||
      !v.thresholds ||
      !v.results_by_platform.length ||
      !v.calibration_version ||
      c.calibration_version !== v.calibration_version ||
      c.records.some(
        (r) =>
          r.metric_name === "harmonized_frp_index" &&
          r.calibration_version !== v.calibration_version,
      ))
  )
    throw Error("Aprovação sem evidências ou calibração coerente");
  const keys = new Set<string>();
  for (const r of c.records) {
    const key = r.period_start + "|" + r.metric_name;
    if (keys.has(key)) throw Error("Registro duplicado");
    keys.add(key);
    if (
      r.temporal_resolution !== "day" ||
      r.cell_id !== null ||
      r.spatial_resolution !== "aoi"
    )
      throw Error("Calendário exige agregados diários por AOI");
  }
  if (
    m.data_status === "real" &&
    (!m.actual_date_range ||
      !m.generated_at_utc ||
      m.coverage_method.includes("pending"))
  )
    throw Error("Dataset real sem proveniência completa");
  return { manifest: m, calendar: c, validation: v, approved };
}
