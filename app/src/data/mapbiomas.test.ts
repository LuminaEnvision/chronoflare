import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  LAND_COVER_ASSET,
  LAND_COVER_YEAR,
  landCoverClasses,
  loadLandCover,
  validateLandCoverDefinition,
  validateLandCoverTileUrl,
} from "./mapbiomas";
const fixture = JSON.parse(
  readFileSync(
    new URL("./__fixtures__/mapbiomas-provider.json", import.meta.url),
    "utf8",
  ),
);
const tileUrl =
  "https://earthengine.googleapis.com/v1/projects/mapbiomas/maps/test-session/tiles/{z}/{x}/{y}";

test("recorded public metadata and English leaf legend match the pinned collection/asset", () => {
  validateLandCoverDefinition(fixture.definition, fixture.legend);
  assert.equal(LAND_COVER_YEAR, 2020);
  assert.ok(LAND_COVER_ASSET.endsWith("collection11_coverage_v3"));
  assert.equal(landCoverClasses.length, 33);
  assert.equal(new Set(landCoverClasses.map((item) => item.value)).size, 33);
});

test("a silent collection, asset, year, resolution or legend change is rejected", () => {
  for (const mutate of [
    (v: any) => {
      v.definition.subthemes[0].badges = ["col. 12"];
    },
    (v: any) => {
      v.definition.subthemes[0].asset.assetId += "_changed";
    },
    (v: any) => {
      v.definition.subthemes[0].asset.years = [2025];
    },
    (v: any) => {
      v.definition.subthemes[0].asset.scale = 10;
    },
    (v: any) => {
      v.legend.legend.items[0].children[0].color = "#ffffff";
    },
    (v: any) => {
      v.legend.legend.subthemeId = "wrong-layer";
    },
  ]) {
    const value = structuredClone(fixture);
    mutate(value);
    assert.throws(() =>
      validateLandCoverDefinition(value.definition, value.legend),
    );
  }
});

test("only provider Earth Engine tile templates are accepted", () => {
  assert.equal(validateLandCoverTileUrl({ url: tileUrl }), tileUrl);
  for (const url of [
    "http:" + tileUrl.slice(6),
    tileUrl.replace("earthengine.googleapis.com", "example.com"),
    tileUrl + "?key=unexpected",
    tileUrl.replace("/projects/mapbiomas/", "/projects/other/"),
    "javascript:alert(1)",
  ])
    assert.throws(() => validateLandCoverTileUrl({ url }));
});

test("anonymous loader requests the fixed year/classes and obtains a fresh session on each call", async () => {
  const original = globalThis.fetch;
  const calls: { url: string; init?: RequestInit }[] = [];
  let sessions = 0;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    calls.push({ url, init });
    const body = url.includes("themes/subthemes")
      ? fixture.definition
      : url.includes("legends/by/key")
        ? fixture.legend
        : { url: tileUrl.replace("test-session", "session-" + ++sessions) };
    return new Response(JSON.stringify(body));
  };
  try {
    const first = await loadLandCover();
    const second = await loadLandCover();
    assert.notEqual(first.tileUrl, second.tileUrl);
    const maps = calls.filter((call) => call.url.includes("maps/map?"));
    assert.equal(maps.length, 2);
    const params = new URL(maps[0].url).searchParams;
    assert.equal(params.get("year"), "2020");
    assert.equal(params.get("territoryId"), "1-4-6");
    assert.equal(params.getAll("pixelValue").length, 33);
    for (const call of calls) {
      assert.equal(call.init?.credentials, "omit");
      assert.equal(call.init?.cache, "no-store");
    }
  } finally {
    globalThis.fetch = original;
  }
});

test("provider failure or changed metadata does not return a tile session", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response("unavailable", { status: 503 });
    await assert.rejects(() => loadLandCover(), /unavailable/);
    let mapRequested = false;
    globalThis.fetch = async (input) => {
      const url = String(input);
      if (url.includes("maps/map")) mapRequested = true;
      const changed = structuredClone(fixture.definition);
      changed.subthemes[0].asset.assetId = "changed";
      return new Response(
        JSON.stringify(
          url.includes("themes/subthemes") ? changed : fixture.legend,
        ),
      );
    };
    await assert.rejects(() => loadLandCover(), /changed/);
    assert.equal(mapRequested, false);
  } finally {
    globalThis.fetch = original;
  }
});

test("caller cancellation reaches provider requests", async () => {
  const original = globalThis.fetch;
  let observed: AbortSignal | null | undefined;
  globalThis.fetch = async (_input, init) => {
    observed = init?.signal;
    return new Promise<Response>((_resolve, reject) => {
      if (observed?.aborted) reject(new DOMException("Aborted", "AbortError"));
      else
        observed?.addEventListener(
          "abort",
          () => reject(new DOMException("Aborted", "AbortError")),
          { once: true },
        );
    });
  };
  try {
    const controller = new AbortController();
    const result = loadLandCover(controller.signal);
    controller.abort();
    await assert.rejects(result, { name: "AbortError" });
    assert.ok(observed?.aborted);
  } finally {
    globalThis.fetch = original;
  }
});
