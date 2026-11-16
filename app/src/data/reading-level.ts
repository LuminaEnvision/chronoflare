export type ReadingLevel = "overview" | "full";

const selectionKeys = ["obs_source", "obs_year", "obs_date", "obs_compare"];

/**
 * Which calendar layout to show. An explicit `obs_detail` always wins. A link that
 * already names a series, year, date or comparison is an inspection link, so it opens
 * with every scientific detail, exactly as it did before the overview existed. Only a
 * visit with no calendar selection opens the overview.
 */
export function readingLevel(search: string): ReadingLevel {
  const params = new URLSearchParams(search);
  const explicit = params.get("obs_detail");
  if (explicit === "overview" || explicit === "full") return explicit;
  return selectionKeys.some((key) => params.has(key)) ? "full" : "overview";
}

/**
 * Keep the level a person is reading at when a selection adds parameters to the
 * address. Without this, choosing a day in the overview would look like an
 * inspection link and switch layouts under them.
 */
export function keepReadingLevel(before: string, params: URLSearchParams) {
  if (!params.has("obs_detail") && readingLevel(before) === "overview")
    params.set("obs_detail", "overview");
}

/** Plain names for the series, with the technical name kept beside them. */
export const plainSourceLabels = {
  harmonized: "Combined estimate (recommended)",
  snpp: "VIIRS only (Suomi-NPP satellite)",
  terra: "MODIS only (Terra satellite)",
  aqua: "MODIS only (Aqua satellite)",
} as const;

/**
 * Evaluator-facing information that must stay reachable in the full layout. Each id
 * marks its block in the calendar with `data-evidence`; a test fails if one disappears.
 */
export const evidenceInventory = [
  [
    "data-origin",
    "Real NASA inputs, region reference and the missing-is-not-zero notice",
  ],
  [
    "approval-summary",
    "Plan A approval, publication scope and its caveat counts",
  ],
  [
    "approval-claim",
    "The scientific owner's approved claim and alignment note",
  ],
  [
    "series-description",
    "What the series measures and that no total is inferred from gaps",
  ],
  [
    "legend-states",
    "Estimate, no estimate, not acquired and beyond-training-range states",
  ],
  ["color-scale", "Fixed logarithmic color scale in MW"],
  [
    "calendar-notes",
    "Keyboard use, scale policy, missing years and sensor comparability",
  ],
  [
    "day-status",
    "Whether the selected day is an estimate, a gap or a native record",
  ],
  [
    "sample-role",
    "Training, previously examined or independent-test role of the date",
  ],
  [
    "day-references",
    "S-NPP observation and uncalibrated MODIS benchmark for the date",
  ],
  ["day-interval", "Empirical 80% interval and the training-range policy"],
  ["solar-day", "Regional solar-day definition"],
  [
    "provenance",
    "Quality and deduplication rule versions and the manifest link",
  ],
] as const;
