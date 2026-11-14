import { test } from "node:test";
import assert from "node:assert/strict";
import { gibsTileUrl, isImageryDateSupported } from "./gibs";

test("GIBS URL uses the selected date and WMTS row/column order", () => {
  assert.equal(
    gibsTileUrl("2024-02-29"),
    "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/2024-02-29/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg",
  );
});

test("invalid, pre-product and future dates cannot be requested", () => {
  const today = new Date("2026-11-14T12:00:00Z");
  for (const invalid of [
    "",
    "2023-02-29",
    "../../secret",
    "2000-02-23",
    "2026-11-15",
  ]) {
    assert.equal(isImageryDateSupported(invalid, today), false);
  }
  assert.equal(isImageryDateSupported("2000-02-24", today), true);
  assert.throws(() => gibsTileUrl("2023-02-29"));
});
