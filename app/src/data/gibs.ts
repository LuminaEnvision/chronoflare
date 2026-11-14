import { z } from "zod";

export const GIBS_LAYER = "MODIS_Terra_CorrectedReflectance_TrueColor";
export const GIBS_MATRIX = "GoogleMapsCompatible_Level9";
export const GIBS_MAX_ZOOM = 9;
export const GIBS_DOCUMENTATION =
  "https://nasa-gibs.github.io/gibs-api-docs/access-basics/";

const imageryDate = z.iso.date();

/** The imagery date is UTC; it is not a local-solar-day fire aggregate. */
export function gibsTileUrl(date: string) {
  imageryDate.parse(date);
  return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${GIBS_LAYER}/default/${date}/${GIBS_MATRIX}/{z}/{y}/{x}.jpg`;
}

export function isImageryDateSupported(date: string, today = new Date()) {
  return (
    imageryDate.safeParse(date).success &&
    date >= "2000-02-24" &&
    date <= today.toISOString().slice(0, 10)
  );
}
