import { z } from "zod";

export const approvedModelHash =
  "3c39071a245d071c60e0838d6092a793190f98e2416e2074bbf75911e00aa3ba";
export const observationSources = [
  "harmonized",
  "snpp",
  "terra",
  "aqua",
] as const;
export type ObservationSource = (typeof observationSources)[number];
export const sourceLabels: Record<ObservationSource, string> = {
  harmonized: "Harmonized · Terra + Aqua",
  snpp: "VIIRS · Suomi-NPP",
  terra: "MODIS · Terra",
  aqua: "MODIS · Aqua",
};
export function isCivilDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(d.valueOf()) && d.toISOString().slice(0, 10) === value;
}
const civilDate = z.string().refine(isCivilDate, "Invalid civil date");
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const positive = z.number().finite().positive();
const turn = z
  .object({ frp_mw: positive, count: z.number().int().positive() })
  .nullable();
const platform = z.object({ day: turn, night: turn });
const harmonized = z
  .object({
    value_mw: positive,
    lower_mw: z.number().finite().nonnegative(),
    upper_mw: z.number().finite().nonnegative(),
    is_extrapolated: z.boolean(),
    regime: z.literal("Terra+Aqua_weighted"),
    inputs: z.object({
      terra_day_mw: positive,
      terra_night_mw: positive,
      aqua_day_mw: positive,
      aqua_night_mw: positive,
      terra_night_source_date: civilDate,
    }),
  })
  .refine((v) => v.lower_mw <= v.upper_mw, "Interval is inverted")
  .nullable();
const daySchema = z.object({
  date: civilDate,
  terra: platform,
  aqua: platform,
  snpp: platform,
  harmonized,
});
export const observationYearSchema = z
  .object({
    schema_version: z.literal("chronoflare-observation-year/1.0.0"),
    year: z.number().int().min(2000).max(2100),
    days: z.array(daySchema).min(1).max(366),
  })
  .superRefine((year, ctx) => {
    let previous = "";
    for (const row of year.days) {
      if (!row.date.startsWith(`${year.year}-`) || row.date <= previous)
        ctx.addIssue({
          code: "custom",
          message: "Dates must be unique, sorted and within the declared year",
        });
      previous = row.date;
      if (row.harmonized) {
        const h = row.harmonized,
          inputs = h.inputs;
        const yesterday = new Date(`${row.date}T12:00:00Z`);
        yesterday.setUTCDate(yesterday.getUTCDate() - 1);
        if (
          inputs.terra_night_source_date !==
          yesterday.toISOString().slice(0, 10)
        )
          ctx.addIssue({
            code: "custom",
            message: "Harmonized Terra night must refer to the previous date",
          });
        if (
          row.terra.day?.frp_mw !== inputs.terra_day_mw ||
          row.aqua.day?.frp_mw !== inputs.aqua_day_mw ||
          row.aqua.night?.frp_mw !== inputs.aqua_night_mw
        )
          ctx.addIssue({
            code: "custom",
            message: "Harmonized inputs must match native turns",
          });
        const previousRow = year.days.find(
          (d) => d.date === inputs.terra_night_source_date,
        );
        if (
          previousRow &&
          previousRow.terra.night?.frp_mw !== inputs.terra_night_mw
        )
          ctx.addIssue({
            code: "custom",
            message: "Aligned Terra night does not match its source date",
          });
      }
    }
  });
export const observationManifestSchema = z
  .object({
    schema_version: z.literal("chronoflare-observations/1.0.0"),
    region_id: z.literal("pantanal_ibge_2025_reference"),
    region_name: z.string().min(1),
    solar_offset_seconds: z.literal(-13596),
    coverage_status: z.literal("unknown"),
    quality_rule_version: z.literal("indicator-sp-quality/1.0.0"),
    dedup_rule_version: z.literal(
      "indicator-exact-key/python-float64-round-1.1.0",
    ),
    source_observation_sha256: z.array(hash).min(1),
    approval: z
      .object({
        decision: z.literal("plan_a"),
        reviewed_by: z.string().min(1),
        scope: z.literal("both_complete_platforms"),
        model_sha256: z.literal(approvedModelHash),
        record_path: z
          .string()
          .regex(/^(?:docs|science/configs)\/[a-zA-Z0-9/_\-.]+$/)
          .refine((s) => !s.includes("..")),
        approved_claim: z.string().min(1),
      })
      .nullable(),
    years: z
      .array(
        z.object({
          year: z.number().int().min(2000).max(2100),
          path: z.string(),
          sha256: hash,
          bytes: z.number().int().positive().max(5_000_000),
          day_count: z.number().int().positive().max(366),
        }),
      )
      .min(1),
  })
  .superRefine((v, ctx) => {
    let previous = 0;
    for (const asset of v.years) {
      if (
        asset.year <= previous ||
        asset.path !== `/data/observations/v1/${asset.year}.json`
      )
        ctx.addIssue({
          code: "custom",
          message:
            "Year assets must be ordered, unique and use fixed local paths",
        });
      previous = asset.year;
    }
  });
export type ObservationManifest = z.infer<typeof observationManifestSchema>;
export type ObservationYear = z.infer<typeof observationYearSchema>;
export type ObservationDay = z.infer<typeof daySchema>;
export function validateObservationYear(
  input: unknown,
  manifest: ObservationManifest,
  expectedYear: number,
) {
  const year = observationYearSchema.parse(input);
  const asset = manifest.years.find((y) => y.year === expectedYear);
  if (
    !asset ||
    year.year !== expectedYear ||
    year.days.length !== asset.day_count
  )
    throw new Error("Year asset does not match its manifest");
  if (!manifest.approval && year.days.some((d) => d.harmonized))
    throw new Error("Unapproved harmonized publication rejected");
  return year;
}
export async function loadObservationManifest(signal?: AbortSignal) {
  const response = await fetch("/data/observations/v1/manifest.json", {
    signal,
  });
  if (!response.ok)
    throw new Error(
      "The real-data export is not published yet. The separate August 2020 review remains available.",
    );
  return observationManifestSchema.parse(await response.json());
}
export async function loadObservationYear(
  manifest: ObservationManifest,
  year: number,
  signal?: AbortSignal,
) {
  const asset = manifest.years.find((y) => y.year === year);
  if (!asset) throw new Error("This year was not acquired");
  const response = await fetch(asset.path, { signal });
  if (!response.ok) throw new Error(`Unable to load observations for ${year}`);
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength !== asset.bytes)
    throw new Error("Observation asset byte count mismatch");
  if (!globalThis.crypto?.subtle)
    throw new Error("Verified data loading requires HTTPS or localhost");
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const actual = Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
  if (actual !== asset.sha256)
    throw new Error("Observation asset integrity mismatch");
  return validateObservationYear(
    JSON.parse(new TextDecoder().decode(bytes)),
    manifest,
    year,
  );
}
export type Reading = {
  value: number | null;
  count: number | null;
  status:
    | "not_acquired"
    | "no_positive_records"
    | "partial_turns"
    | "both_turns"
    | "not_publishable"
    | "estimated";
  lower?: number;
  upper?: number;
  extrapolated?: boolean;
};
export function readingFor(
  day: ObservationDay | undefined,
  source: ObservationSource,
): Reading {
  if (!day) return { value: null, count: null, status: "not_acquired" };
  if (source === "harmonized") {
    const h = day.harmonized;
    return h
      ? {
          value: h.value_mw,
          count: null,
          status: "estimated",
          lower: h.lower_mw,
          upper: h.upper_mw,
          extrapolated: h.is_extrapolated,
        }
      : { value: null, count: null, status: "not_publishable" };
  }
  const turns = [day[source].day, day[source].night].filter((t) => t !== null);
  return {
    value: turns.length ? turns.reduce((sum, t) => sum + t.frp_mw, 0) : null,
    count: turns.length ? turns.reduce((sum, t) => sum + t.count, 0) : null,
    status:
      turns.length === 2
        ? "both_turns"
        : turns.length
          ? "partial_turns"
          : "no_positive_records",
  };
}
export const readingLabels: Record<Reading["status"], string> = {
  not_acquired: "Not acquired",
  no_positive_records: "No selected positive records · coverage unknown",
  partial_turns: "One turn only · partial observed sum",
  both_turns: "Day and night recorded · coverage unknown",
  not_publishable:
    "No publishable estimate · both complete MODIS platforms required",
  estimated: "Calibrated estimate · both complete MODIS platforms",
};
export function yearDates(year: number) {
  const dates: string[] = [];
  for (
    let d = new Date(Date.UTC(year, 0, 1, 12));
    d.getUTCFullYear() === year;
    d.setUTCDate(d.getUTCDate() + 1)
  )
    dates.push(d.toISOString().slice(0, 10));
  return dates;
}
export function observationSelection(
  search: string,
  manifest: ObservationManifest,
) {
  const p = new URLSearchParams(search);
  const fallbackYear =
    manifest.years.find((y) => y.year === 2020)?.year ??
    manifest.years.at(-1)!.year;
  const requestedYear = Number(p.get("obs_year"));
  const year = manifest.years.some((y) => y.year === requestedYear)
    ? requestedYear
    : fallbackYear;
  const requestedSource = p.get("obs_source");
  const source: ObservationSource =
    observationSources.find(
      (s) => s === requestedSource && (s !== "harmonized" || manifest.approval),
    ) ?? (manifest.approval ? "harmonized" : "snpp");
  const requestedDate = p.get("obs_date") ?? `${year}-08-01`;
  const date =
    isCivilDate(requestedDate) && requestedDate.startsWith(`${year}-`)
      ? requestedDate
      : `${year}-01-01`;
  const requestedComparison = Number(p.get("obs_compare"));
  const compareYear =
    requestedComparison !== year &&
    manifest.years.some((y) => y.year === requestedComparison)
      ? requestedComparison
      : null;
  return { year, source, date, compareYear };
}
export function navigateObservation(patch: Record<string, string>) {
  const url = new URL(window.location.href);
  for (const [key, value] of Object.entries(patch))
    value ? url.searchParams.set(key, value) : url.searchParams.delete(key);
  if (url.href !== window.location.href) {
    window.history.pushState({}, "", url);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }
}
