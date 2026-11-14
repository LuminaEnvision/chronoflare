import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadDataset } from "./load";
import { dataAssetPathSchema } from "./schema";

const manifest = JSON.parse(
  readFileSync("app/public/data/v1/manifest.json", "utf8"),
);
const calendar = JSON.parse(
  readFileSync(`app/public${manifest.files.calendar_day}`, "utf8"),
);
const validation = JSON.parse(
  readFileSync(`app/public${manifest.files.validation}`, "utf8"),
);

test("manifest is validated before fetching any referenced asset", async (t) => {
  const paths: string[] = [];
  t.mock.method(globalThis, "fetch", async (path: string) => {
    paths.push(path);
    return Response.json({
      ...manifest,
      files: { ...manifest.files, calendar_day: "/data/v1/../../secret.json" },
    });
  });
  await assert.rejects(loadDataset());
  assert.deepEqual(paths, ["/data/v1/manifest.json"]);
});

test("missing assets and malformed JSON fail rather than render stale values", async (t) => {
  t.mock.method(
    globalThis,
    "fetch",
    async () => new Response("Missing", { status: 404 }),
  );
  await assert.rejects(loadDataset(), /File unavailable/);
  t.mock.method(
    globalThis,
    "fetch",
    async () => new Response("<html>fallback</html>"),
  );
  await assert.rejects(loadDataset(), SyntaxError);
});

test("valid static artifacts load together and request cache revalidation", async (t) => {
  const files: Record<string, unknown> = {
    "/data/v1/manifest.json": manifest,
    [manifest.files.calendar_day]: calendar,
    [manifest.files.validation]: validation,
  };
  t.mock.method(
    globalThis,
    "fetch",
    async (path: string, options: RequestInit) => {
      assert.equal(options.cache, "no-cache");
      assert.ok(path in files);
      return Response.json(files[path]);
    },
  );
  const result = await loadDataset();
  assert.equal(result.manifest.dataset_version, manifest.dataset_version);
  assert.equal(result.approved, false);
});

test("external origins, encoded traversal and non-JSON data paths are rejected", () => {
  for (const path of [
    "https://example.com/a.json",
    "/data/v1//a.json",
    "/data/v1/%2e%2e/a.json",
    "/data/v1/a.json?redirect=x",
    "/data/v1/./a.json",
    "/data/v1/a.csv",
  ]) {
    assert.equal(dataAssetPathSchema.safeParse(path).success, false);
  }
  assert.equal(
    dataAssetPathSchema.safeParse(
      "/data/v1/regions/pantanal-pilot/calendar/day.json",
    ).success,
    true,
  );
});
