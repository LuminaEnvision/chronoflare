import type {
  ComparisonPoint,
  ComparisonPointStatus,
  ComparisonSegment,
} from "./annual-comparison";
import { formatDate, formatMetric } from "./format";
import type { Basis } from "./selection";

export const CHART_SLOTS = 366;
export const FEBRUARY_29_SLOT = 59;

const coverageText: Record<ComparisonPointStatus, string> = {
  available: "Adequate coverage",
  partial: "Partial coverage",
  no_data: "No data",
  no_value: "No value",
  missing_record: "Missing record",
  not_in_year: "Not in this year",
};

export function sourceLabel(basis: Basis) {
  if (basis === "modis") return "Original MODIS";
  if (basis === "harmonized") return "Harmonized";
  return "Original VIIRS";
}

/** Map a value onto the shared scale. A constant series, including zeros, stays on one line. */
export function valueToY(
  value: number,
  extent: { min: number; max: number },
  top: number,
  bottom: number,
) {
  const span = extent.max - extent.min;
  if (span === 0) return (top + bottom) / 2;
  const pad = span * 0.08;
  const min = extent.min - pad;
  const max = extent.max + pad;
  return bottom - ((value - min) / (max - min)) * (bottom - top);
}

/** One segment only. A gap or a change of coverage must start a new path. */
export function segmentPath(
  points: readonly ComparisonPoint[],
  segment: ComparisonSegment,
  x: (slot: number) => number,
  y: (value: number) => number,
) {
  let path = "";
  for (let slot = segment.startSlot; slot <= segment.endSlot; slot += 1) {
    const point = points.find((item) => item.slot === slot);
    if (!point || point.value === null) continue;
    path += `${path ? "L" : "M"}${x(slot).toFixed(1)} ${y(point.value).toFixed(1)}`;
  }
  return path;
}

export function describePoint(
  point: ComparisonPoint,
  basis: Basis,
  unit: string,
) {
  const source = sourceLabel(basis);
  if (point.status === "not_in_year" || !point.date) {
    return `${source} · This date does not exist in this year.`;
  }
  const date = formatDate(point.date);
  const coverage = coverageText[point.status];
  if (point.value === null) {
    return `${date} · ${source} · No value · ${coverage}. Missing data is not zero.`;
  }
  const measured = point.value === 0 ? " · Measured zero" : "";
  const estimated =
    point.record?.value_basis === "estimated_from_modis"
      ? " · Estimated from MODIS"
      : "";
  const extrapolated = point.record?.is_extrapolated ? " · Extrapolated" : "";
  return `${date} · ${source} · ${formatMetric(point.value)} ${unit}${measured} · ${coverage}${estimated}${extrapolated}`;
}
