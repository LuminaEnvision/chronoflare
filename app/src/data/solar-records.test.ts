import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { solarPreviewSchema } from "./experimental-solar";
import {
  loadSolarRecords,
  parseSolarRecords,
  recordId,
  validateRecordManifest,
} from "./solar-records";
const root = "app/public/data/experimental/records-v1/";
const previewBytes = readFileSync(
  "app/public/data/experimental/v1/pantanal-solar.json",
);
const preview = solarPreviewSchema.parse(JSON.parse(previewBytes.toString()));
const manifestInput = () =>
  JSON.parse(readFileSync(root + "manifest.json", "utf8"));
const manifest = validateRecordManifest(manifestInput(), preview);
const entry = manifest.entries.find(
  (value) => value.platform === "Terra" && value.solar_date === "2020-08-15",
)!;
const shard = () => JSON.parse(readFileSync(root + entry.path, "utf8"));
test("all 33,413 source rows reproduce every raw/filtered calendar cell and hash", () => {
  assert.equal(
    manifest.preview_sha256,
    createHash("sha256").update(previewBytes).digest("hex"),
  );
  let count = 0;
  const ids = new Set<string>();
  for (const entry of manifest.entries) {
    const payload = readFileSync(root + entry.path);
    assert.equal(payload.length, entry.bytes);
    assert.equal(
      createHash("sha256").update(payload).digest("hex"),
      entry.sha256,
    );
    const rows = parseSolarRecords(
      JSON.parse(payload.toString()),
      entry,
      preview,
    );
    for (const row of rows) {
      assert.ok(!ids.has(recordId(row)));
      ids.add(recordId(row));
    }
    count += rows.length;
  }
  assert.equal(count, 33413);
  assert.equal(count, manifest.record_count);
});
test("last solar day includes verified next-UTC-day padding records", () => {
  const rows = parseSolarRecords(shard(), entry, preview);
  assert.ok(rows.some((row) => row.acquired_at_utc.startsWith("2020-08-16")));
  assert.ok(
    rows.every(
      (row) =>
        Date.parse(row.acquired_at_utc) < Date.parse("2020-08-16T03:46:36Z"),
    ),
  );
});
test("manifest rejects path traversal, missing cells and inconsistent source totals", () => {
  for (const change of [
    (value: any) => {
      value.entries[0].path = "../v1/pantanal-solar.json";
    },
    (value: any) => {
      value.entries[1] = value.entries[0];
    },
    (value: any) => {
      value.entries[0].record_count++;
    },
    (value: any) => {
      value.record_count++;
    },
    (value: any) => {
      value.quality_rule.status = "approved";
    },
  ]) {
    const value = manifestInput();
    change(value);
    assert.throws(() => validateRecordManifest(value, preview));
  }
});
test("rejects wrong solar times, changed quality decisions and broken row lineage", () => {
  for (const change of [
    (value: any) => {
      value.records[0].acquired_at_utc = "2020-08-15T00:00:00Z";
    },
    (value: any) => {
      value.records[0].candidate_quality_pass =
        !value.records[0].candidate_quality_pass;
    },
    (value: any) => {
      value.records[0].source_record = 999999999;
    },
    (value: any) => {
      value.records[0].source_file_sha256 = "0".repeat(64);
    },
    (value: any) => {
      value.records[0].frp_mw += 1;
    },
    (value: any) => {
      value.records[1] = value.records[0];
    },
  ]) {
    const value = shard();
    change(value);
    assert.throws(() => parseSolarRecords(value, entry, preview));
  }
});
const originalFetch = globalThis.fetch;
function fixtureFetch(corrupt?: "records" | "snapshot") {
  globalThis.fetch = async (input) => {
    const path = String(input);
    let content = readFileSync("app/public" + path);
    if (corrupt === "records" && path.endsWith(entry.path))
      content = Buffer.from(
        content.toString().replace('"source_record":', '"source_recorx":'),
      );
    if (corrupt === "snapshot" && path.endsWith("/v1/pantanal-solar.json"))
      content = Buffer.concat([content, Buffer.from(" ")]);
    return new Response(new Uint8Array(content));
  };
}
test("loader binds one day shard to the exact displayed snapshot", async () => {
  fixtureFetch();
  try {
    const rows = await loadSolarRecords(
      preview,
      "Terra",
      "2020-08-15",
      new AbortController().signal,
    );
    assert.equal(rows.length, entry.record_count);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
test("loader fails on same-length record corruption and changed snapshot bytes", async () => {
  try {
    fixtureFetch("records");
    await assert.rejects(
      loadSolarRecords(
        preview,
        "Terra",
        "2020-08-15",
        new AbortController().signal,
      ),
      /integrity check failed/,
    );
    fixtureFetch("snapshot");
    await assert.rejects(
      loadSolarRecords(
        preview,
        "Terra",
        "2020-08-15",
        new AbortController().signal,
      ),
      /different calendar snapshot/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
