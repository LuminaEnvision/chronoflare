import type { Dataset } from "./schema";

export const views = ["calendar", "map", "methodology"] as const;
export const bases = ["viirs", "modis", "harmonized"] as const;
export type View = (typeof views)[number];
export type Basis = (typeof bases)[number];
export type Selection = {
  view: View;
  basis: Basis;
  date: string;
  region: string;
  compare: string;
  /** Empty until a comparison source is chosen. Then viirs, modis, or approved harmonized. */
  compare_basis: string;
  /** Empty, one year, or two different years as "2024,2023". */
  years: string;
};
export type SelectionPatch = Partial<Record<keyof Selection, string>>;
export type ResolvedSelection = {
  selection: Selection;
  availableBases: Basis[];
  dateRange: { start: string; end: string } | null;
  issues: string[];
};

const routingKeys = [
  "view",
  "basis",
  "date",
  "region",
  "compare",
  "compare_basis",
  "years",
] as const;

/** Sensor used by the two-year comparison. An empty choice follows the calendar basis. */
export function comparisonSource(
  selection: Pick<Selection, "basis" | "compare_basis">,
  available: readonly Basis[],
): Basis {
  const requested = bases.find((value) => value === selection.compare_basis);
  if (requested && available.includes(requested)) return requested;
  if (available.includes(selection.basis)) return selection.basis;
  return (
    available.find((value) => value !== "harmonized") ?? available[0] ?? "viirs"
  );
}
export const basisMetrics: Readonly<Record<Basis, string>> = {
  viirs: "viirs_frp_sum",
  modis: "modis_frp_sum",
  harmonized: "harmonized_frp_index",
};

export function isSelectionDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T00:00:00Z");
  return (
    !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value
  );
}

export function availableBases(dataset: Dataset): Basis[] {
  const present = new Set(
    dataset.calendar.records.map((record) => record.metric_name),
  );
  return bases.filter(
    (basis) =>
      present.has(basisMetrics[basis]) &&
      (basis !== "harmonized" || dataset.approved),
  );
}

/** Resolve against records, not guessed coverage or the browser's current date. */
export function resolveSelection(
  search: string,
  dataset?: Dataset,
): ResolvedSelection {
  const params = new URLSearchParams(search);
  const issues: string[] = [];
  if (routingKeys.some((key) => params.getAll(key).length > 1)) {
    issues.push("Duplicate navigation parameters were removed.");
  }
  const requestedView = params.get("view");
  const view = views.find((value) => value === requestedView) ?? "calendar";
  if (requestedView !== null && requestedView !== view) {
    issues.push("The requested view is invalid. Calendar was selected.");
  }
  const requestedBasis = params.get("basis");
  const available = dataset ? availableBases(dataset) : [];
  const defaultBasis = available.includes("harmonized")
    ? "harmonized"
    : (available[0] ?? "viirs");
  let basis = bases.find((value) => value === requestedBasis) ?? defaultBasis;
  if (requestedBasis !== null && requestedBasis !== basis) {
    issues.push(
      "The requested data basis is invalid. An available basis was selected.",
    );
  }
  if (dataset && !available.includes(basis)) {
    if (
      requestedBasis !== null &&
      bases.some((value) => value === requestedBasis)
    ) {
      issues.push(
        basis === "harmonized"
          ? "Harmonized data is unavailable until approval and matching records are present. An available original basis was selected."
          : "The requested basis has no records in this dataset. An available basis was selected.",
      );
    }
    basis = defaultBasis;
  }
  if (dataset && available.length === 0) {
    issues.push("No supported calendar basis is available in this dataset.");
  }

  const requestedRegion = params.get("region");
  const region =
    dataset?.calendar.region_id ?? requestedRegion ?? "pantanal-pilot";
  if (dataset && requestedRegion !== null && requestedRegion !== region) {
    issues.push(
      "The requested region is not loaded. The available region was selected.",
    );
  }
  const dates = dataset
    ? [
        ...new Set(
          dataset.calendar.records
            .filter((record) => record.metric_name === basisMetrics[basis])
            .map((record) => record.period_start),
        ),
      ].sort()
    : [];
  const dateRange = dates.length
    ? { start: dates[0], end: dates[dates.length - 1] }
    : null;
  const requestedDate = params.get("date");
  let date =
    requestedDate !== null && isSelectionDate(requestedDate)
      ? requestedDate
      : (dateRange?.end ?? "");
  if (requestedDate !== null && !isSelectionDate(requestedDate)) {
    issues.push(
      "The requested date is invalid. The latest available date was selected.",
    );
  }
  if (dateRange && (date < dateRange.start || date > dateRange.end)) {
    date = date < dateRange.start ? dateRange.start : dateRange.end;
    issues.push(
      "The requested date is outside this basis's range. The nearest range boundary was selected.",
    );
  }
  // Valid dates inside the range can be gaps. Never replace them with a nearby
  // observation, interpolate, or infer a zero from the selection layer.
  const requestedCompare = params.get("compare");
  let compare = requestedCompare ?? "";
  const dayYears = new Set(dates.map((value) => value.slice(0, 4)));
  if (
    compare &&
    (!/^\d{4}$/.test(compare) ||
      compare === date.slice(0, 4) ||
      (dataset && !dayYears.has(compare)))
  ) {
    compare = "";
    issues.push(
      "The comparison year is unavailable or matches the selected year. Comparison was cleared.",
    );
  }
  const requestedCompareBasis = params.get("compare_basis");
  let compare_basis = "";
  if (requestedCompareBasis !== null && requestedCompareBasis !== "") {
    const known = bases.find((value) => value === requestedCompareBasis);
    const allowed = !!known && (!dataset || available.includes(known as Basis));
    if (!allowed) {
      issues.push(
        known === "harmonized"
          ? "Harmonized comparisons remain unavailable until approval. An available sensor was selected."
          : "The comparison source is unavailable. An available sensor was selected.",
      );
    } else compare_basis = known;
  }
  const source = comparisonSource({ basis, compare_basis }, available);
  const sourceYears = new Set(
    (dataset?.calendar.records ?? [])
      .filter((record) => record.metric_name === basisMetrics[source])
      .map((record) => record.period_start.slice(0, 4)),
  );
  const requestedYears = params.get("years");
  let years = "";
  if (requestedYears) {
    const parts = requestedYears.split(",");
    const wellFormed =
      parts.length <= 2 &&
      parts.every((part) => part === "" || /^\d{4}$/.test(part)) &&
      !(parts[0] && parts[1] && parts[0] === parts[1]);
    if (!wellFormed) {
      issues.push("Choose two different years. The comparison was cleared.");
    } else if (dataset) {
      const kept = parts.filter((part) => part && sourceYears.has(part));
      if (kept.length !== parts.filter(Boolean).length) {
        issues.push(
          "A comparison year is not in this source. That year was removed.",
        );
      }
      years = kept.join(",");
    } else years = parts.filter(Boolean).join(",");
  }
  return {
    selection: { view, basis, date, region, compare, compare_basis, years },
    availableBases: available,
    dateRange,
    issues,
  };
}

/** Preserve unrelated query parameters while canonicalizing routing keys. */
export function selectionSearch(search: string, selection: Selection): string {
  const params = new URLSearchParams(search);
  for (const key of routingKeys) params.delete(key);
  for (const key of routingKeys) {
    if (selection[key]) params.set(key, selection[key]);
  }
  return "?" + params.toString();
}

export type SelectionLocation = {
  pathname: string;
  search: string;
  hash: string;
};
export type SelectionBrowser = {
  location(): SelectionLocation;
  push(url: string): void;
  replace(url: string): void;
  onPopState(callback: () => void): () => void;
};

/** Small browser-independent store so history behavior is testable offline. */
export function createSelectionStore(browser: SelectionBrowser) {
  let dataset: Dataset | undefined;
  let snapshot = resolveSelection(browser.location().search);
  const locationKey = () => {
    const current = browser.location();
    return current.pathname + current.search + current.hash;
  };
  let observedLocation = locationKey();
  const listeners = new Set<() => void>();
  let removePopState: (() => void) | undefined;

  function publish(result: ResolvedSelection) {
    snapshot = result;
    for (const listener of listeners) listener();
  }

  function write(result: ResolvedSelection, mode: "push" | "replace") {
    const current = browser.location();
    const search = selectionSearch(current.search, result.selection);
    const target = current.pathname + search + current.hash;
    if (target !== current.pathname + current.search + current.hash)
      browser[mode](target);
    observedLocation = locationKey();
    publish(result);
  }

  function read() {
    const result = resolveSelection(browser.location().search, dataset);
    if (dataset) write(result, "replace");
    else {
      observedLocation = locationKey();
      publish(result);
    }
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      if (!removePopState) {
        removePopState = browser.onPopState(read);
        // Catch navigation between render and subscription without erasing
        // correction notices during React Strict Mode's resubscription.
        if (locationKey() !== observedLocation) read();
      }
      return () => {
        listeners.delete(listener);
        if (!listeners.size) {
          removePopState?.();
          removePopState = undefined;
        }
      };
    },
    setDataset(value: Dataset | undefined) {
      if (value === dataset) return;
      dataset = value;
      read();
    },
    update(patch: SelectionPatch) {
      const params = new URLSearchParams(browser.location().search);
      // During loading, preserve the original deep link until its dataset can
      // be checked. Once loaded, updates start from the canonical selection.
      const base = dataset
        ? new URLSearchParams(
            selectionSearch(params.toString(), snapshot.selection),
          )
        : params;
      for (const [key, value] of Object.entries(patch)) base.set(key, value);
      if ("date" in patch && !isSelectionDate(patch.date!)) {
        if (snapshot.selection.date) base.set("date", snapshot.selection.date);
        else base.delete("date");
        const result = resolveSelection(base.toString(), dataset);
        result.issues.push(
          "Invalid date input was ignored. The current selection was preserved.",
        );
        write(result, "replace");
        return;
      }
      write(resolveSelection(base.toString(), dataset), "push");
    },
  };
}
