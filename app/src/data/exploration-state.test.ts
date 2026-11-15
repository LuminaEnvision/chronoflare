import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  adjacentValueDate,
  chartRolesValue,
  chartSelection,
  comparisonDay,
} from "./exploration-state";
import { observationYearSchema } from "./observations";
import { sampleRoles } from "./harmonization-pairs";

test("shared comparison day preserves February 29 and rejects rollover dates", () => {
  assert.equal(comparisonDay("?obs_compare_day=02-29"), "02-29");
  assert.equal(
    comparisonDay("?obs_compare_day=08-02&obs_date=2020-08-01"),
    "08-02",
  );
  for (const value of ["02-30", "13-01", "2020-08-02", ""])
    assert.equal(comparisonDay(`?obs_compare_day=${value}`), "08-01");
});
test("role filters round-trip including explicit no-groups state and pinned date", () => {
  for (const roles of [
    [],
    [sampleRoles[0]],
    [sampleRoles[1], sampleRoles[0]],
    [...sampleRoles],
  ]) {
    const params = new URLSearchParams({
      pair_roles: chartRolesValue(roles),
      pair_date: "2020-08-01",
    });
    const restored = chartSelection(params.toString());
    assert.deepEqual(
      restored.roles,
      sampleRoles.filter((r) => roles.includes(r)),
    );
    assert.equal(restored.date, "2020-08-01");
  }
  assert.deepEqual(chartSelection("?pair_roles=none").roles, []);
  assert.deepEqual(chartSelection("").roles, [...sampleRoles]);
  assert.deepEqual(chartSelection("?pair_roles=unexpected").roles, [
    ...sampleRoles,
  ]);
  assert.equal(chartSelection("?pair_date=2025-02-29").date, "");
  assert.equal(chartSelection("?pair_date=2024-02-29").date, "2024-02-29");
});
test("explicit navigation finds sparse estimates without replacing or filling requested gaps", () => {
  const year = observationYearSchema.parse(
    JSON.parse(
      readFileSync(
        new URL("../../public/data/observations/v1/2025.json", import.meta.url),
        "utf8",
      ),
    ),
  );
  const before = JSON.stringify(year);
  assert.equal(
    adjacentValueDate(year, "harmonized", "2025-08-01", "next"),
    "2025-10-05",
  );
  assert.equal(
    adjacentValueDate(year, "harmonized", "2025-08-01", "previous"),
    null,
  );
  assert.equal(
    adjacentValueDate(year, "harmonized", "2025-10-05", "next"),
    "2025-10-08",
  );
  assert.equal(
    adjacentValueDate(year, "harmonized", "2025-12-06", "next"),
    null,
  );
  assert.equal(
    adjacentValueDate(year, "harmonized", "2025-10-08", "previous"),
    "2025-10-05",
  );
  assert.equal(
    year.days.find((d) => d.date === "2025-08-01")!.harmonized,
    null,
  );
  assert.equal(JSON.stringify(year), before);
});
test("native navigation uses positive recorded values including partial turns, never inferred zeros", () => {
  const turn = { frp_mw: 2, count: 1 };
  const year = observationYearSchema.parse({
    schema_version: "chronoflare-observation-year/1.0.0",
    year: 2020,
    days: [
      {
        date: "2020-08-01",
        terra: { day: null, night: null },
        aqua: { day: null, night: null },
        snpp: { day: null, night: null },
        harmonized: null,
      },
      {
        date: "2020-08-02",
        terra: { day: turn, night: null },
        aqua: { day: null, night: null },
        snpp: { day: null, night: null },
        harmonized: null,
      },
    ],
  });
  assert.equal(
    adjacentValueDate(year, "terra", "2020-08-01", "next"),
    "2020-08-02",
  );
  assert.equal(adjacentValueDate(year, "snpp", "2020-08-01", "next"), null);
});
