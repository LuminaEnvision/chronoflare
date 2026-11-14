import type { ActivityAggregate, Dataset } from "./schema";
import {
  availableBases,
  bases,
  basisMetrics,
  isSelectionDate,
  type Basis,
} from "./selection";

export type ComparisonPointStatus =
  | "available"
  | "partial"
  | "no_data"
  | "no_value"
  | "missing_record"
  | "not_in_year";
export type ComparisonPoint = {
  slot: number;
  monthDay: string;
  date: string | null;
  value: number | null;
  status: ComparisonPointStatus;
  record: Readonly<ActivityAggregate> | null;
};
export type ComparisonSegment = {
  startSlot: number;
  endSlot: number;
  status: "available" | "partial";
  valueBasis: ActivityAggregate["value_basis"];
  isExtrapolated: boolean;
};

/** A shared leap-year axis preserves month/day alignment without shifting March. */
export const comparisonAxis = Object.freeze(
  Array.from({ length: 366 }, (_, slot) =>
    Object.freeze({
      slot,
      monthDay: new Date(Date.UTC(2000, 0, slot + 1))
        .toISOString()
        .slice(5, 10),
    }),
  ),
);

function segmentsFor(points: ComparisonPoint[]): ComparisonSegment[] {
  const segments: ComparisonSegment[] = [];
  let active: ComparisonSegment | undefined;
  for (const point of points) {
    if (
      point.value === null ||
      !point.record ||
      (point.status !== "available" && point.status !== "partial")
    ) {
      active = undefined;
      continue;
    }
    const basis = point.record.value_basis;
    const extrapolated = point.record.is_extrapolated;
    if (
      active &&
      active.endSlot === point.slot - 1 &&
      active.status === point.status &&
      active.valueBasis === basis &&
      active.isExtrapolated === extrapolated
    ) {
      active.endSlot = point.slot;
    } else {
      active = {
        startSlot: point.slot,
        endSlot: point.slot,
        status: point.status,
        valueBasis: basis,
        isExtrapolated: extrapolated,
      };
      segments.push(active);
    }
  }
  return segments;
}

function pointStatus(record: ActivityAggregate): ComparisonPointStatus {
  if (record.coverage_flag === "no_data") return "no_data";
  if (record.coverage_flag === "partial") return "partial";
  return record.metric_value === null ? "no_value" : "available";
}

function yearSeries(year: number, records: ActivityAggregate[]) {
  const yearText = String(year).padStart(4, "0");
  const byDate = new Map<string, ActivityAggregate>();
  for (const record of records) {
    if (record.period_start.slice(0, 4) !== yearText) continue;
    if (byDate.has(record.period_start))
      throw Error(
        `Duplicate daily comparison record for ${record.period_start}.`,
      );
    byDate.set(record.period_start, record);
  }
  if (!byDate.size)
    throw Error(`No records are available for comparison year ${year}.`);
  const points: ComparisonPoint[] = comparisonAxis.map(({ slot, monthDay }) => {
    const date = `${yearText}-${monthDay}`;
    if (!isSelectionDate(date))
      return {
        slot,
        monthDay,
        date: null,
        value: null,
        status: "not_in_year",
        record: null,
      };
    const record = byDate.get(date);
    if (!record)
      return {
        slot,
        monthDay,
        date,
        value: null,
        status: "missing_record",
        record: null,
      };
    return {
      slot,
      monthDay,
      date,
      value: record.metric_value,
      status: pointStatus(record),
      record: { ...record },
    };
  });
  const count = (predicate: (point: ComparisonPoint) => boolean) =>
    points.filter(predicate).length;
  return {
    year,
    points,
    segments: segmentsFor(points),
    counts: {
      calendarDays: count((point) => point.status !== "not_in_year"),
      recordDays: count((point) => point.record !== null),
      valueDays: count((point) => point.value !== null),
      missingRecordDays: count((point) => point.status === "missing_record"),
      noDataDays: count((point) => point.status === "no_data"),
      nullValueDays: count(
        (point) => point.record !== null && point.value === null,
      ),
      partialDays: count((point) => point.status === "partial"),
      zeroDays: count(
        (point) => point.status === "available" && point.value === 0,
      ),
      notInYearSlots: count((point) => point.status === "not_in_year"),
    },
  };
}

/** Technical presentation adapter for an already validated Dataset. No science is fitted here. */
export function buildAnnualComparison(
  dataset: Dataset,
  { basis, years }: { basis: Basis; years: readonly [number, number] },
) {
  if (!bases.some((value) => value === basis))
    throw Error("Unknown comparison basis.");
  if (
    !Array.isArray(years) ||
    years.length !== 2 ||
    years.some((year) => !Number.isInteger(year) || year < 1 || year > 9999) ||
    years[0] === years[1]
  ) {
    throw Error("Choose two distinct calendar years between 1 and 9999.");
  }
  if (!availableBases(dataset).includes(basis))
    throw Error(
      "The comparison basis is unavailable or lacks scientific approval.",
    );
  const metric = basisMetrics[basis];
  const records = dataset.calendar.records.filter(
    (record) => record.metric_name === metric,
  );
  for (const record of records) {
    if (
      (basis === "modis" && record.value_basis !== "observed_modis") ||
      (basis === "viirs" && record.value_basis !== "observed_viirs")
    ) {
      throw Error(
        "Original-sensor comparison records have an incompatible value basis.",
      );
    }
    if (basis === "harmonized" && record.value_basis === "observed_modis") {
      throw Error(
        "Unconverted MODIS observations cannot be labeled as a harmonized comparison.",
      );
    }
  }
  const series = years.map((year) => yearSeries(year, records));
  let valueExtent: { min: number; max: number } | null = null;
  for (const year of series)
    for (const point of year.points) {
      if (point.value === null) continue;
      valueExtent = valueExtent
        ? {
            min: Math.min(valueExtent.min, point.value),
            max: Math.max(valueExtent.max, point.value),
          }
        : { min: point.value, max: point.value };
    }
  return {
    schemaVersion: "annual-comparison/1.0.0",
    regionId: dataset.calendar.region_id,
    basis,
    metricName: metric,
    units: basis === "harmonized" ? "relative index" : "MW",
    datasetVersion: dataset.manifest.dataset_version,
    methodologyVersion: dataset.manifest.methodology_version,
    calibrationVersion: dataset.calendar.calibration_version,
    dataStatus: dataset.manifest.data_status,
    decision: dataset.manifest.decision,
    validationStatus: dataset.validation.status,
    datasetSources: [...dataset.manifest.sources],
    combinationRule: dataset.validation.combination_rule,
    coverageMethod: dataset.manifest.coverage_method,
    pre2012Notice: dataset.validation.pre2012_notice,
    limitations: [...dataset.validation.limitations],
    valueExtent,
    series,
    notice:
      "Calendar alignment and record counts do not establish scientific comparability or observation coverage. No annual totals, baseline, anomaly, calibration, or approval was computed.",
  };
}

export type AnnualComparison = ReturnType<typeof buildAnnualComparison>;
