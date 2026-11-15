import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseDataset, type Dataset } from "./schema";
import { activateSelectionLink, selectionHref } from "./link-navigation";
import {
  availableBases,
  createSelectionStore,
  isSelectionDate,
  resolveSelection,
  selectionSearch,
  type SelectionBrowser,
} from "./selection";

const read = (path: string) =>
  JSON.parse(readFileSync(`app/public/data/v1/${path}`, "utf8"));
const manifest = read("manifest.json");
const calendar = read("regions/pantanal-pilot/calendar/day.json");
const validation = read("validation/summary.json");
const dates = new Set([
  "2023-03-01",
  "2024-02-28",
  "2024-02-29",
  "2024-03-01",
  "2025-09-01",
  "2025-12-31",
]);
const dataset = parseDataset(
  manifest,
  {
    ...calendar,
    records: calendar.records.filter((r: { period_start: string }) =>
      dates.has(r.period_start),
    ),
  },
  validation,
);

function approvedDataset(includeRecords = true): Dataset {
  const version = "test-only-calibration";
  return parseDataset(
    { ...manifest, harmonization_approved: true, decision: "plan_a" },
    {
      ...dataset.calendar,
      calibration_version: version,
      records: [
        ...dataset.calendar.records,
        ...(includeRecords
          ? dataset.calendar.records
              .filter((r) => r.metric_name === "viirs_frp_sum")
              .map((r) => ({
                ...r,
                metric_name: "harmonized_frp_index",
                calibration_version: version,
              }))
          : []),
      ],
    },
    {
      ...validation,
      decision: "plan_a",
      status: "passed",
      calibration_version: version,
      thresholds_registered_at: "2026-11-14T00:00:00Z",
      thresholds: { test_only: true },
      results_by_platform: [{ test_only: true }],
    },
  );
}

class FakeBrowser implements SelectionBrowser {
  entries: string[];
  position = 0;
  pushes = 0;
  replacements = 0;
  listeners = new Set<() => void>();
  constructor(url = "https://example.test/demo") {
    this.entries = [url];
  }
  location() {
    const url = new URL(this.entries[this.position]);
    return { pathname: url.pathname, search: url.search, hash: url.hash };
  }
  push(url: string) {
    this.pushes++;
    this.entries = this.entries.slice(0, this.position + 1);
    this.entries.push(new URL(url, this.entries[this.position]).href);
    this.position++;
  }
  replace(url: string) {
    this.replacements++;
    this.entries[this.position] = new URL(
      url,
      this.entries[this.position],
    ).href;
  }
  onPopState(callback: () => void) {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }
  back() {
    if (this.position) {
      this.position--;
      for (const listener of this.listeners) listener();
    }
  }
  forward() {
    if (this.position < this.entries.length - 1) {
      this.position++;
      for (const listener of this.listeners) listener();
    }
  }
}

test("ISO selection dates reject impossible days, timestamps, and non-ISO input", () => {
  for (const value of [
    "",
    "2023-02-29",
    "2024-02-30",
    "2025-13-01",
    "2025-1-01",
    "2024-02-29T00:00:00Z",
    "../../file",
    "not-a-date",
  ]) {
    assert.equal(isSelectionDate(value), false, value);
  }
  assert.equal(isSelectionDate("2024-02-29"), true);
});

test("initial selection uses actual sorted records rather than a hardcoded date", () => {
  const reversed = {
    ...dataset,
    calendar: {
      ...dataset.calendar,
      records: [...dataset.calendar.records].reverse(),
    },
  };
  const result = resolveSelection("", reversed);
  assert.deepEqual(result.selection, {
    view: "calendar",
    basis: "viirs",
    date: "2025-12-31",
    region: "pantanal-pilot",
    compare: "",
    compare_basis: "",
    years: "",
  });
  assert.deepEqual(result.dateRange, {
    start: "2023-03-01",
    end: "2025-12-31",
  });
  assert.deepEqual(result.issues, []);
});

test("invalid URL state falls back without enabling unapproved harmonization", () => {
  const result = resolveSelection(
    "?view=unknown&basis=harmonized&date=2023-02-29&region=elsewhere&compare=9999",
    dataset,
  );
  assert.equal(result.selection.view, "calendar");
  assert.equal(result.selection.basis, "viirs");
  assert.equal(result.selection.date, "2025-12-31");
  assert.equal(result.selection.region, "pantanal-pilot");
  assert.equal(result.selection.compare, "");
  assert.equal(result.issues.length, 5);
});

test("out-of-range dates clamp to the selected basis boundary", () => {
  assert.equal(
    resolveSelection("?date=2000-01-01", dataset).selection.date,
    "2023-03-01",
  );
  assert.equal(
    resolveSelection("?date=2099-01-01", dataset).selection.date,
    "2025-12-31",
  );
});

test("valid gap dates stay selected without modifying or filling data", () => {
  const before = JSON.stringify(dataset);
  const result = resolveSelection("?date=2024-06-01&compare=2023", dataset);
  assert.equal(result.selection.date, "2024-06-01");
  assert.equal(result.selection.compare, "2023");
  assert.deepEqual(result.issues, []);
  assert.equal(JSON.stringify(dataset), before);
});

test("leap-day comparison preserves the day even if the target year has no February 29", () => {
  const result = resolveSelection("?date=2024-02-29&compare=2023", dataset);
  assert.equal(result.selection.date, "2024-02-29");
  assert.equal(result.selection.compare, "2023");
  assert.equal(
    dataset.calendar.records.some((r) => r.period_start === "2023-02-29"),
    false,
  );
});

test("comparison rejects the selected year and accepts another available year", () => {
  assert.equal(
    resolveSelection("?date=2024-03-01&compare=2024", dataset).selection
      .compare,
    "",
  );
  assert.equal(
    resolveSelection("?date=2024-03-01&compare=2025", dataset).selection
      .compare,
    "2025",
  );
});

test("basis availability comes from matching records and approval", () => {
  assert.deepEqual(availableBases(dataset), ["viirs", "modis"]);
  const modisOnly = {
    ...dataset,
    calendar: {
      ...dataset.calendar,
      records: dataset.calendar.records.filter(
        (r) => r.metric_name === "modis_frp_sum",
      ),
    },
  };
  assert.deepEqual(availableBases(modisOnly), ["modis"]);
  assert.equal(
    resolveSelection("?basis=viirs", modisOnly).selection.basis,
    "modis",
  );
  assert.equal(
    resolveSelection("?basis=__proto__", dataset).selection.basis,
    "viirs",
  );
  assert.deepEqual(availableBases(approvedDataset()), [
    "viirs",
    "modis",
    "harmonized",
  ]);
  assert.equal(
    resolveSelection("", approvedDataset()).selection.basis,
    "harmonized",
  );
  assert.equal(
    resolveSelection("?basis=modis", approvedDataset()).selection.basis,
    "modis",
  );
  assert.equal(
    resolveSelection("?basis=harmonized", approvedDataset(false)).selection
      .basis,
    "viirs",
  );
});

test("duplicate routing keys are canonicalized while unrelated query values survive", () => {
  const search =
    "?view=map&view=calendar&date=2024-02-29&utm_source=team&tag=a&tag=b";
  const result = resolveSelection(search, dataset);
  assert.equal(result.selection.view, "map");
  assert.ok(result.issues.some((issue) => issue.includes("Duplicate")));
  const canonical = new URLSearchParams(
    selectionSearch(search, result.selection),
  );
  assert.deepEqual(canonical.getAll("view"), ["map"]);
  assert.deepEqual(canonical.getAll("tag"), ["a", "b"]);
  assert.equal(canonical.get("utm_source"), "team");
  assert.equal(canonical.has("compare"), false);
});

test("pending deep links remain intact until their loaded dataset can be checked", () => {
  const browser = new FakeBrowser(
    "https://example.test/demo?view=map&basis=harmonized&date=2024-02-29#details",
  );
  const store = createSelectionStore(browser);
  const unsubscribe = store.subscribe(() => {});
  assert.equal(browser.replacements, 0);
  assert.equal(store.getSnapshot().selection.basis, "harmonized");
  store.setDataset(approvedDataset());
  assert.equal(store.getSnapshot().selection.basis, "harmonized");
  assert.equal(store.getSnapshot().selection.date, "2024-02-29");
  assert.equal(browser.location().hash, "#details");
  unsubscribe();
});

test("dataset hydration replaces initial URL once without a spurious history entry", () => {
  const browser = new FakeBrowser(
    "https://example.test/demo?utm_source=team#legend",
  );
  const store = createSelectionStore(browser);
  store.setDataset(dataset);
  assert.equal(browser.pushes, 0);
  assert.equal(browser.replacements, 1);
  assert.equal(browser.location().pathname, "/demo");
  assert.equal(browser.location().hash, "#legend");
  assert.equal(
    new URLSearchParams(browser.location().search).get("utm_source"),
    "team",
  );
  const snapshot = store.getSnapshot();
  store.setDataset(dataset);
  assert.equal(store.getSnapshot(), snapshot);
  assert.equal(browser.replacements, 1);
});

test("view, date and comparison navigation can be restored with back and forward", () => {
  const browser = new FakeBrowser(
    "https://example.test/demo?date=2024-02-29&compare=2023#details",
  );
  const store = createSelectionStore(browser);
  const unsubscribe = store.subscribe(() => {});
  store.setDataset(dataset);
  store.update({ view: "map" });
  store.update({ date: "2024-03-01" });
  store.update({ view: "methodology" });
  assert.equal(browser.pushes, 3);
  browser.back();
  assert.equal(store.getSnapshot().selection.view, "map");
  assert.equal(store.getSnapshot().selection.date, "2024-03-01");
  browser.back();
  assert.equal(store.getSnapshot().selection.date, "2024-02-29");
  assert.equal(store.getSnapshot().selection.compare, "2023");
  browser.forward();
  assert.equal(store.getSnapshot().selection.date, "2024-03-01");
  assert.equal(browser.pushes, 3);
  assert.equal(browser.location().hash, "#details");
  unsubscribe();
});

test("invalid interactive dates preserve the current selection and history", () => {
  const browser = new FakeBrowser("https://example.test/demo?date=2024-02-29");
  const store = createSelectionStore(browser);
  store.setDataset(dataset);
  for (const date of ["", "2023-02-29", "bad-date"]) {
    store.update({ date });
    assert.equal(store.getSnapshot().selection.date, "2024-02-29");
    assert.ok(
      store.getSnapshot().issues.some((issue) => issue.includes("ignored")),
    );
  }
  assert.equal(browser.pushes, 0);
  store.update({ view: "calendar" });
  assert.equal(browser.pushes, 0);
});

test("changing date to the comparison year clears the invalid comparison", () => {
  const browser = new FakeBrowser(
    "https://example.test/demo?date=2024-02-29&compare=2023",
  );
  const store = createSelectionStore(browser);
  store.setDataset(dataset);
  store.update({ date: "2023-03-01" });
  assert.equal(store.getSnapshot().selection.compare, "");
  assert.equal(
    new URLSearchParams(browser.location().search).has("compare"),
    false,
  );
});

test("history subscriptions clean up without duplicate popstate listeners", () => {
  const browser = new FakeBrowser();
  const store = createSelectionStore(browser);
  assert.equal(browser.listeners.size, 0);
  const first = store.subscribe(() => {});
  const second = store.subscribe(() => {});
  assert.equal(browser.listeners.size, 1);
  first();
  assert.equal(browser.listeners.size, 1);
  second();
  assert.equal(browser.listeners.size, 0);
  const again = store.subscribe(() => {});
  assert.equal(browser.listeners.size, 1);
  again();
  assert.equal(browser.listeners.size, 0);
});

test("resubscription retains the explanation for a corrected deep link", () => {
  const browser = new FakeBrowser("https://example.test/demo?date=2023-02-29");
  const store = createSelectionStore(browser);
  store.setDataset(dataset);
  const corrected = store.getSnapshot();
  assert.ok(corrected.issues.length > 0);
  const unsubscribe = store.subscribe(() => {});
  unsubscribe();
  const again = store.subscribe(() => {});
  assert.equal(store.getSnapshot(), corrected);
  again();
});

test("a URL change between construction and subscription is not lost", () => {
  const browser = new FakeBrowser();
  const store = createSelectionStore(browser);
  browser.replace("/demo?view=map&date=2024-02-29");
  const unsubscribe = store.subscribe(() => {});
  assert.equal(store.getSnapshot().selection.view, "map");
  assert.equal(store.getSnapshot().selection.date, "2024-02-29");
  unsubscribe();
});

test("Home preserves the data context and Back returns to the previous view", () => {
  const browser = new FakeBrowser(
    "https://example.test/demo?view=map&basis=modis&date=2024-02-29&region=pantanal-pilot&compare=2023&utm_source=team#details",
  );
  const store = createSelectionStore(browser);
  const unsubscribe = store.subscribe(() => {});
  store.setDataset(dataset);
  const before = store.getSnapshot().selection;
  const href = selectionHref(browser.location(), before, "calendar");
  assert.deepEqual(
    resolveSelection(new URL(href, "https://example.test").search, dataset)
      .selection,
    { ...before, view: "calendar" },
  );
  let prevented = false;
  activateSelectionLink(
    {
      button: 0,
      defaultPrevented: false,
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      currentTarget: { target: "" },
      preventDefault() {
        prevented = true;
      },
    },
    () => store.update({ view: "calendar" }),
  );
  assert.equal(prevented, true);
  assert.equal(browser.pushes, 1);
  assert.deepEqual(store.getSnapshot().selection, {
    ...before,
    view: "calendar",
  });
  assert.equal(
    new URLSearchParams(browser.location().search).get("utm_source"),
    "team",
  );
  assert.equal(browser.location().hash, "#details");
  browser.back();
  assert.deepEqual(store.getSnapshot().selection, before);
  unsubscribe();
});

test("two comparison years stay in the URL and restore with back and forward", () => {
  const browser = new FakeBrowser("https://example.test/demo?date=2024-02-29");
  const store = createSelectionStore(browser);
  const unsubscribe = store.subscribe(() => {});
  store.setDataset(dataset);
  store.update({ compare_basis: "modis" });
  store.update({ years: "2024,2023" });
  assert.equal(store.getSnapshot().selection.compare_basis, "modis");
  assert.equal(store.getSnapshot().selection.years, "2024,2023");
  assert.equal(store.getSnapshot().selection.basis, "viirs");
  browser.back();
  assert.equal(store.getSnapshot().selection.years, "");
  assert.equal(store.getSnapshot().selection.compare_basis, "modis");
  browser.forward();
  assert.equal(store.getSnapshot().selection.years, "2024,2023");
  assert.equal(
    new URLSearchParams(browser.location().search).get("years"),
    "2024,2023",
  );
  unsubscribe();
});

test("identical or missing comparison years are not kept", () => {
  const same = resolveSelection("?years=2024,2024", dataset);
  assert.equal(same.selection.years, "");
  assert.match(same.issues.join(" "), /different years/);
  const missing = resolveSelection("?years=1999,2024", dataset);
  assert.equal(missing.selection.years, "2024");
  assert.match(missing.issues.join(" "), /not in this source/);
  assert.equal(
    resolveSelection("?years=2024", dataset).selection.years,
    "2024",
  );
});

test("unapproved harmonized comparison stays unavailable", () => {
  const result = resolveSelection(
    "?basis=viirs&compare_basis=harmonized&years=2024,2023",
    dataset,
  );
  assert.equal(result.selection.basis, "viirs");
  assert.equal(result.selection.compare_basis, "");
  assert.match(
    result.issues.join(" "),
    /Harmonized comparisons remain unavailable/,
  );
  assert.equal(result.selection.years, "2024,2023");
});

test("scoped navigation does not invent demo basis or region in a real-data URL", () => {
  const browser = new FakeBrowser(
    "https://example.test/?obs_source=harmonized&obs_year=2020&pair_roles=none#content",
  );
  const store = createSelectionStore(browser, { scoped: true });
  store.setDataset(undefined);
  store.update({ view: "map" });
  let params = new URLSearchParams(browser.location().search);
  assert.equal(params.get("view"), "map");
  for (const key of ["basis", "region", "date", "demo_basis", "demo_region"])
    assert.equal(params.has(key), false, key);
  assert.equal(params.get("obs_source"), "harmonized");
  assert.equal(params.get("pair_roles"), "none");
  store.update({ view: "calendar" });
  params = new URLSearchParams(browser.location().search);
  assert.equal(params.has("view"), false);
  assert.equal(browser.location().hash, "#content");
});

test("scoped routing migrates legacy choices without touching actual observation and map filters", () => {
  const browser = new FakeBrowser(
    "https://example.test/?view=calendar&basis=modis&date=2024-02-29&region=pantanal-pilot&compare=2023&years=2024,2023&obs_source=harmonized&review_region=pantanal",
  );
  const store = createSelectionStore(browser, { scoped: true });
  store.setDataset(undefined);
  const params = new URLSearchParams(browser.location().search);
  assert.equal(params.get("demo_basis"), "modis");
  assert.equal(params.get("demo_date"), "2024-02-29");
  assert.equal(params.get("demo_region"), "pantanal-pilot");
  assert.equal(params.get("demo_compare"), "2023");
  assert.equal(params.get("demo_years"), "2024,2023");
  assert.equal(params.get("obs_source"), "harmonized");
  assert.equal(params.get("review_region"), "pantanal");
  for (const key of ["basis", "date", "region", "compare", "years", "view"])
    assert.equal(params.has(key), false, key);
});

test("demo choices round-trip across real data, copied links and browser history", () => {
  const browser = new FakeBrowser(
    "https://example.test/?calendar_data=demo&basis=modis&date=2024-02-29&compare=2023&obs_year=2020",
  );
  const store = createSelectionStore(browser, { scoped: true });
  const unsubscribe = store.subscribe(() => {});
  store.setDataset(dataset);
  assert.equal(store.getSnapshot().selection.basis, "modis");
  const go = (search: string) => {
    browser.push("/" + search);
    for (const listener of browser.listeners) listener();
  };
  let params = new URLSearchParams(browser.location().search);
  params.set("calendar_data", "observations");
  go("?" + params);
  store.setDataset(undefined);
  assert.equal(
    new URLSearchParams(browser.location().search).get("demo_basis"),
    "modis",
  );
  store.update({ view: "map" });
  store.update({ view: "calendar" });
  const copied = new FakeBrowser(
    "https://example.test/" + browser.location().search,
  );
  const restored = createSelectionStore(copied, { scoped: true });
  restored.setDataset(undefined);
  let copiedParams = new URLSearchParams(copied.location().search);
  copiedParams.set("calendar_data", "demo");
  copied.push("/?" + copiedParams);
  restored.setDataset(dataset);
  assert.equal(restored.getSnapshot().selection.basis, "modis");
  assert.equal(restored.getSnapshot().selection.date, "2024-02-29");
  assert.equal(restored.getSnapshot().selection.compare, "2023");
  const active = new URLSearchParams(copied.location().search);
  assert.equal(active.get("basis"), "modis");
  assert.equal(active.has("demo_basis"), false);
  browser.back();
  assert.equal(store.getSnapshot().selection.view, "map");
  browser.forward();
  assert.equal(store.getSnapshot().selection.view, "calendar");
  unsubscribe();
});

test("scoped Home links preserve new context without publishing a legacy source", () => {
  const location = {
    pathname: "/",
    search:
      "?view=map&obs_source=harmonized&demo_basis=modis&review_source=viirs",
    hash: "#content",
  };
  const resolved = resolveSelection(location.search);
  const href = selectionHref(location, resolved.selection, "calendar", true);
  const params = new URL(href, "https://example.test").searchParams;
  assert.equal(params.has("view"), false);
  assert.equal(params.has("basis"), false);
  assert.equal(params.get("obs_source"), "harmonized");
  assert.equal(params.get("demo_basis"), "modis");
  assert.equal(params.get("review_source"), "viirs");
});

test("an empty scoped homepage stays query-free and normalizes only once", () => {
  const browser = new FakeBrowser("https://example.test/");
  const store = createSelectionStore(browser, { scoped: true });
  store.setDataset(undefined);
  store.setDataset(undefined);
  assert.equal(browser.location().search, "");
  assert.equal(browser.replacements, 0);
  assert.equal(browser.pushes, 0);
});
