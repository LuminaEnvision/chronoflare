import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

function cli(...args: string[]) {
  return spawnSync(
    process.execPath,
    ["--import", "tsx", resolve("scripts/compare-years.ts"), ...args],
    { encoding: "utf8" },
  );
}
const request = ["--basis", "viirs", "--years", "2024,2023"];

test("comparison CLI inspects validated fixtures without writing by default", () => {
  const result = cli(...request);
  assert.equal(result.status, 0, result.stderr);
  const summary = JSON.parse(result.stdout);
  assert.equal(summary.dataStatus, "fixture");
  assert.equal(summary.outputWritten, false);
  assert.deepEqual(
    summary.years.map((r: { year: number; calendarDays: number }) => [
      r.year,
      r.calendarDays,
    ]),
    [
      [2024, 366],
      [2023, 365],
    ],
  );
  assert.equal("annualTotal" in summary, false);
});

test("comparison JSON export is explicit and never overwrites an existing file", () => {
  const root = mkdtempSync(join(tmpdir(), "chronoflare-compare-"));
  try {
    const output = join(root, "inspection.json");
    const first = cli(...request, "--output", output);
    assert.equal(first.status, 0, first.stderr);
    const before = readFileSync(output, "utf8");
    const artifact = JSON.parse(before);
    assert.equal(artifact.schemaVersion, "annual-comparison/1.0.0");
    assert.equal(artifact.dataStatus, "fixture");
    assert.equal(artifact.series.length, 2);
    assert.equal(artifact.series[0].points.length, 366);
    assert.equal(artifact.series[1].points[59].status, "not_in_year");
    const second = cli(...request, "--output", output);
    assert.notEqual(second.status, 0);
    assert.equal(readFileSync(output, "utf8"), before);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("comparison CLI refuses invalid requests and unapproved harmonized data", () => {
  for (const args of [
    [],
    ["--basis", "viirs", "--years", "2024,2024"],
    ["--basis", "unknown", "--years", "2024,2023"],
    ["--basis", "harmonized", "--years", "2024,2023"],
  ]) {
    const result = cli(...args);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Comparison failed:/);
    assert.equal(result.stdout, "");
  }
  assert.equal(cli("--help").status, 0);
});

test("inspection output cannot enter frontend directories, including hidden child paths", () => {
  for (const directory of ["app", "dist"]) {
    const output = resolve(
      directory,
      `..comparison-probe-${randomUUID()}.json`,
    );
    try {
      const result = cli(...request, "--output", output);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /cannot be written into app\/ or dist\//);
      assert.equal(existsSync(output), false);
    } finally {
      rmSync(output, { force: true });
    }
  }
});

test(
  "frontend output guard follows parent-directory symlinks",
  { skip: process.platform === "win32" },
  () => {
    const root = mkdtempSync(join(tmpdir(), "chronoflare-compare-link-"));
    const filename = `comparison-probe-${randomUUID()}.json`;
    const actual = resolve("app", filename);
    try {
      const link = join(root, "alias");
      symlinkSync(resolve("app"), link, "dir");
      const result = cli(...request, "--output", join(link, filename));
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /cannot be written into app\/ or dist\//);
      assert.equal(existsSync(actual), false);
    } finally {
      rmSync(actual, { force: true });
      rmSync(root, { recursive: true, force: true });
    }
  },
);
