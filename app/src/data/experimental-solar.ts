import { z } from "zod";

export const solarPlatforms = ["Terra", "Aqua", "S-NPP"] as const;
export type SolarPlatform = (typeof solarPlatforms)[number];
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const count = z.number().int().positive().nullable();
const totals = z.object({
  detection_count: count,
  raw_frp_sum_mw: z.number().positive().nullable(),
});
const rowSchema = z
  .object({
    solar_date: z.string().regex(/^2020-08-(0[1-9]|1[0-5])$/),
    platform: z.enum(solarPlatforms),
    period_start_utc: z.string(),
    period_end_utc_exclusive: z.string(),
    input_window_complete: z.literal(true),
    coverage_status: z.literal("unknown"),
    coverage_fraction: z.null(),
    overpass_count: z.null(),
    operational_state: z.literal("unknown"),
    all_detections: totals,
    proposed_filter: totals,
    rejected_record_count: z.number().int().nonnegative(),
    rejection_reason_counts: z.record(
      z.string(),
      z.number().int().nonnegative(),
    ),
  })
  .superRefine((row, context) => {
    const fail = (message: string) =>
      context.addIssue({ code: "custom", message });
    const start = `${row.solar_date}T03:46:36+00:00`;
    if (
      row.period_start_utc !== start ||
      Date.parse(row.period_end_utc_exclusive) - Date.parse(start) !== 86400000
    )
      fail("Solar window must match the fixed regional reference");
    const raw = row.all_detections.detection_count ?? 0;
    const selected = row.proposed_filter.detection_count ?? 0;
    if (selected > raw || row.rejected_record_count !== raw - selected)
      fail("Filtered counts must reconcile with raw counts");
    for (const value of Object.values(row.rejection_reason_counts))
      if (value > row.rejected_record_count)
        fail("Rejection counts exceed rejected records");
    for (const value of [row.all_detections, row.proposed_filter])
      if (value.detection_count === null && value.raw_frp_sum_mw !== null)
        fail("Absent positives require null raw totals");
    if (
      row.proposed_filter.raw_frp_sum_mw !== null &&
      (row.all_detections.raw_frp_sum_mw === null ||
        row.proposed_filter.raw_frp_sum_mw > row.all_detections.raw_frp_sum_mw)
    )
      fail("Filtered raw FRP cannot exceed the unfiltered total");
  });
const quality = z.object({
  id: z.literal("vegetation-candidate/1.0.0"),
  status: z.literal("proposed_unapproved"),
  type: z.literal("0 only"),
  modis_confidence_minimum: z.literal(30),
  viirs_confidence_classes: z.tuple([z.literal("nominal"), z.literal("high")]),
  missing_fields: z.literal("indeterminate; not selected"),
  deduplication: z.literal("none"),
});
const reconciliation = z.object({
  shared_field_matches: z.number().int().nonnegative(),
  matched_occurrences_including_source_type: z.number().int().nonnegative(),
  api_only_occurrences: z.number().int().nonnegative(),
  reference_only_occurrences: z.number().int().nonnegative(),
});
export const solarPreviewSchema = z
  .object({
    schema_version: z.literal("experimental-solar/1.0.0"),
    status: z.literal("real_unreviewed"),
    scientific_approval: z.literal(false),
    approved_metric: z.literal(false),
    region_id: z.literal("pantanal_ibge_2025_reference"),
    reference_manifest_sha256: z.literal(
      "f9a7eacabff51dddfc490d9cd23dea90627ac10eb757d489f9dd04b2094ce43a",
    ),
    start_solar_date: z.literal("2020-08-01"),
    end_solar_date_inclusive: z.literal("2020-08-15"),
    solar_rule_version: z.literal("pantanal-fixed-reference/1.0.0"),
    solar_offset_seconds: z.literal(-13596),
    source_utc_start: z.literal("2020-08-01T00:00:00Z"),
    source_utc_end_exclusive: z.literal("2020-08-17T00:00:00Z"),
    quality_rule: quality,
    input_csv_sha256: z.array(hash).length(8),
    provenance: z
      .array(
        z.object({
          source: z.enum(["MODIS_SP", "VIIRS_SNPP_SP"]),
          sha256: hash,
          retrieved_at_utc: z.string().datetime({ offset: true }),
          requested_start_utc: z.string(),
          requested_end_utc_inclusive: z.string(),
          row_count: z.number().int().nonnegative(),
        }),
      )
      .length(8),
    reference_reconciliation: z.object({
      modis: reconciliation,
      viirs: reconciliation,
    }),
    notice: z.string(),
    records: z.array(rowSchema).length(45),
  })
  .superRefine((data, context) => {
    const keys = new Set(
      data.records.map((row) => `${row.solar_date}|${row.platform}`),
    );
    if (keys.size !== 45)
      context.addIssue({
        code: "custom",
        message: "Expected each solar day and platform exactly once",
      });
    const expected = new Set(
      ["MODIS_SP", "VIIRS_SNPP_SP"].flatMap((source) => [
        `${source}|2020-08-01|2020-08-05`,
        `${source}|2020-08-06|2020-08-10`,
        `${source}|2020-08-11|2020-08-15`,
        `${source}|2020-08-16|2020-08-16`,
      ]),
    );
    for (const [index, item] of data.provenance.entries()) {
      if (
        !expected.delete(
          `${item.source}|${item.requested_start_utc}|${item.requested_end_utc_inclusive}`,
        ) ||
        data.input_csv_sha256[index] !== item.sha256
      )
        context.addIssue({
          code: "custom",
          message: "CSV provenance does not match the padded request plan",
        });
    }
  });
export type SolarPreview = z.infer<typeof solarPreviewSchema>;
export const solarAssetPath = "/data/experimental/v1/pantanal-solar.json";
export async function loadSolarPreview(signal: AbortSignal) {
  const response = await fetch(solarAssetPath, { cache: "no-cache", signal });
  if (!response.ok)
    throw Error("Experimental data could not be loaded. Please retry.");
  return solarPreviewSchema.parse(await response.json());
}
export const subscribeLocation = (callback: () => void) => {
  window.addEventListener("popstate", callback);
  return () => window.removeEventListener("popstate", callback);
};
export const locationSearch = () => window.location.search;
export function solarSelection(search: string) {
  const params = new URLSearchParams(search);
  const platform =
    solarPlatforms.find((value) => value === params.get("solar_platform")) ??
    "S-NPP";
  const requested = params.get("solar_day") ?? "";
  return {
    experimental: params.get("calendar_data") === "experimental",
    platform,
    day: /^2020-08-(0[1-9]|1[0-5])$/.test(requested) ? requested : "2020-08-01",
    filtered: params.get("solar_filter") === "proposed",
  };
}
export function solarSearch(
  search: string,
  patch: Partial<{
    calendar_data: string;
    solar_day: string;
    solar_platform: string;
    solar_filter: string;
  }>,
) {
  const params = new URLSearchParams(search);
  for (const [key, value] of Object.entries(patch)) {
    if (value) params.set(key, value);
    else params.delete(key);
  }
  return `?${params}`;
}
export function navigateSolar(patch: Parameters<typeof solarSearch>[1]) {
  window.history.pushState(
    null,
    "",
    `${window.location.pathname}${solarSearch(window.location.search, patch)}${window.location.hash}`,
  );
  window.dispatchEvent(new PopStateEvent("popstate"));
}
