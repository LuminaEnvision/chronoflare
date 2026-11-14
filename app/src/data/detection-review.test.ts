import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  datesBetween,
  groupReviewPoints,
  parseReviewDay,
  parseReviewManifest,
  resolveReviewSelection,
  reviewSelectionSearch,
  checkedAsset,
  type DatedReviewPoint,
} from "./detection-review";

const root = new URL("../../public/data/detection-review/v1/", import.meta.url);
const manifestValue = JSON.parse(
  readFileSync(new URL("manifest.json", root), "utf8"),
);
const manifest = parseReviewManifest(manifestValue);
const clone = () => structuredClone(manifestValue);
const row = (id: number, longitude = -56.5): DatedReviewPoint => ({
  date: "2020-08-01",
  point: [id, longitude, -18.5, "04:30:00Z", "S-NPP", 0, "l", "0"],
});

test("shipped raw review assets match hashes, counts, dates and platforms independently of fixtures", () => {
  let total = 0;
  for (const key of ["modis", "viirs"] as const) {
    const seen = new Set<number>();
    for (const item of manifest.sources[key].days) {
      const bytes = readFileSync(new URL(item.path, root));
      assert.equal(bytes.length, item.bytes);
      assert.equal(
        createHash("sha256").update(bytes).digest("hex"),
        item.sha256,
      );
      assert.ok(
        bytes.length < 1_500_000,
        "Daily files must remain below 1.5 MB",
      );
      const points = parseReviewDay(
        JSON.parse(bytes.toString()),
        key,
        item.date,
        item.count,
      );
      for (const point of points) {
        assert.ok(!seen.has(point.point[0]));
        seen.add(point.point[0]);
      }
      total += points.length;
    }
    assert.equal(seen.size, manifest.sources[key].record_count);
  }
  assert.equal(total, 204919);
  assert.equal(manifest.aoi_status, "not_applied");
  assert.equal(manifest.scope, "brazil_download");
  assert.ok(!("aoi" in manifestValue));
  assert.equal(existsSync(new URL("aoi.json", root)), false);
  assert.equal(manifest.status, "raw_unreviewed");
  assert.equal(manifest.coverage_status, "unknown");
});

test("review manifests reject scientific promotion, missing days, wrong source, traversal and totals", () => {
  const mutations = [
    (m: any) => {
      m.status = "real";
    },
    (m: any) => {
      m.aoi_status = "confirmed";
    },
    (m: any) => {
      m.sources.viirs.days.pop();
    },
    (m: any) => {
      m.sources.viirs.source_dataset = "MODIS_SP";
    },
    (m: any) => {
      m.sources.modis.days[0].path = "../v1/calendar.json";
    },
    (m: any) => {
      m.sources.modis.record_count++;
    },
  ];
  for (const mutate of mutations) {
    const value = clone();
    mutate(value);
    assert.throws(() => parseReviewManifest(value));
  }
});

test("daily data retains zero/low confidence but rejects wrong platform, count and repeated record references", () => {
  const value = {
    schema_version: "detection-review/1.0.0",
    source: "viirs",
    date: "2020-08-01",
    points: [row(1).point],
  };
  assert.equal(parseReviewDay(value, "viirs", value.date, 1)[0].point[5], 0);
  assert.throws(() => parseReviewDay(value, "modis", value.date, 1));
  assert.throws(() => parseReviewDay(value, "viirs", "2020-08-02", 1));
  assert.throws(() => parseReviewDay(value, "viirs", value.date, 2));
  assert.throws(() =>
    parseReviewDay(
      { ...value, points: [row(1).point, row(1).point] },
      "viirs",
      value.date,
      2,
    ),
  );
  const wrong = row(2);
  wrong.point[4] = "Terra";
  assert.throws(() =>
    parseReviewDay({ ...value, points: [wrong.point] }, "viirs", value.date, 1),
  );
});

test("display grouping conserves every detection including coincident records and becomes individual at zoom 10", () => {
  const rows = [row(1), row(2), row(3, -54), row(4, -58)];
  for (const zoom of [3, 6, 9, 10, 14]) {
    const groups = groupReviewPoints(rows, zoom);
    assert.deepEqual(
      groups.flatMap((group) => group.rows.map((row) => row.point[0])).sort(),
      [1, 2, 3, 4],
    );
    if (zoom >= 10) assert.equal(groups.length, rows.length);
  }
  assert.equal(groupReviewPoints([row(1), row(2)], 6).length, 1);
});

test("review filters keep synthetic calendar and annual-comparison URL state separate", () => {
  const search =
    "?view=map&basis=modis&date=2025-12-31&years=2024%2C2023&utm_source=test";
  const resolved = resolveReviewSelection(search, manifest);
  assert.equal(resolved.selection.start, "2020-08-01");
  assert.equal(resolved.selection.source, "viirs");
  assert.equal(resolved.corrected, false);
  const params = new URLSearchParams(
    reviewSelectionSearch(search, {
      ...resolved.selection,
      source: "modis",
      end: "2020-08-15",
      imagery: true,
    }),
  );
  assert.equal(params.get("date"), "2025-12-31");
  assert.equal(params.get("basis"), "modis");
  assert.equal(params.get("years"), "2024,2023");
  assert.equal(params.get("utm_source"), "test");
  assert.equal(params.get("raw_to"), "2020-08-15");
});

test("review filters correct invalid, reversed, duplicate and incompatible platform inputs", () => {
  const result = resolveReviewSelection(
    "?raw_source=harmonized&raw_from=2025-02-30&raw_to=2019-01-01&raw_satellite=Aqua",
    manifest,
  );
  assert.equal(result.corrected, true);
  assert.deepEqual(result.selection, {
    source: "viirs",
    start: "2020-08-01",
    end: "2020-08-01",
    satellite: "all",
    imagery: false,
  });
  assert.equal(
    resolveReviewSelection("?raw_from=2020-08-15&raw_to=2020-08-01", manifest)
      .selection.end,
    "2020-08-15",
  );
  assert.equal(
    resolveReviewSelection("?raw_source=modis&raw_source=viirs", manifest)
      .corrected,
    true,
  );
});

test("inclusive UTC windows preserve leap dates and reject impossible/oversized ranges", () => {
  assert.deepEqual(datesBetween("2020-02-28", "2020-03-01"), [
    "2020-02-28",
    "2020-02-29",
    "2020-03-01",
  ]);
  assert.throws(() => datesBetween("2021-02-29", "2021-03-01"));
  assert.throws(() => datesBetween("2020-08-15", "2020-08-01"));
  assert.throws(() => datesBetween("2020-01-01", "2022-01-01"));
});

test("asset loader refuses corrupted content, HTTP errors and unscoped paths", async () => {
  const originalFetch = globalThis.fetch;
  try {
    const data = '{"test":true}\n';
    const item = {
      path: "viirs/2020-08-01.json",
      sha256: createHash("sha256").update(data).digest("hex"),
      bytes: Buffer.byteLength(data),
    };
    globalThis.fetch = async () => new Response(data);
    assert.deepEqual(await checkedAsset(item), { test: true });
    await assert.rejects(
      () => checkedAsset({ ...item, sha256: "0".repeat(64) }),
      /integrity/,
    );
    await assert.rejects(
      () => checkedAsset({ ...item, bytes: 0 }),
      /integrity/,
    );
    await assert.rejects(
      () => checkedAsset({ ...item, path: "https://example.com/secret" }),
      /path/,
    );
    globalThis.fetch = async () => new Response("", { status: 503 });
    await assert.rejects(() => checkedAsset(item), /unavailable/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
