import { z } from "zod";
import { isSelectionDate } from "./selection";

export const REVIEW_ROOT = "/data/detection-review/v1/";
export const reviewSources = ["viirs", "modis"] as const;
export type ReviewSource = (typeof reviewSources)[number];
const day = z.string().refine(isSelectionDate, "Invalid UTC date");
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const count = z.number().int().nonnegative();
const asset = z.object({ path: z.string(), sha256: digest, bytes: count });
const dailyAsset = asset.extend({ date: day, count });
const sourceSchema = z.object({
  source_dataset: z.enum(["MODIS_SP", "VIIRS_SNPP_SP"]),
  request_id: z.string().regex(/^\d+$/),
  input_sha256: digest,
  input_file: z.string().min(1),
  normalization_version: z.string().min(1),
  collection_values: z.array(z.string().min(1)),
  record_count: count,
  days: z.array(dailyAsset).min(1).max(367),
});
export const IBGE_ARCHIVE_SHA256 =
  "247b15c427070805044ebe02012f15552850d535fbfecaddb359875cdda1ea8f";
const pantanalSchema = z.object({
  name: z.literal("Pantanal"),
  status: z.literal("raw_unreviewed"),
  source_status: z.literal("verified_official_reference"),
  membership_rule: z.string().min(1),
  boundary: asset,
  provenance: z.object({
    institution: z.literal("IBGE"),
    edition: z.literal("2025"),
    archive_url: z.literal(
      "https://geoftp.ibge.gov.br/informacoes_ambientais/estudos_ambientais/biomas/vetores/2025_Biomas-e-Sistema-Costeiro-Marinho-do-Brasil-1-250000_shp.zip",
    ),
    archive_sha256: z.literal(IBGE_ARCHIVE_SHA256),
    source_layer: z.string().min(1),
    feature_selection: z.string().min(1),
    source_crs: z.literal("EPSG:4674"),
    output_crs: z.literal("OGC:CRS84"),
    transformation: z.string().min(1),
    transformation_accuracy_metres: z.number().nonnegative(),
    geometry_policy: z.string().min(1),
  }),
  sources: z.object({
    modis: sourceSchema.extend({ boundary_record_count: count }),
    viirs: sourceSchema.extend({ boundary_record_count: count }),
  }),
  notice: z.string().min(1),
});
export type ReviewRegion = "brazil" | "pantanal";
const manifestSchema = z.object({
  schema_version: z.literal("detection-review/1.0.0"),
  status: z.literal("raw_unreviewed"),
  aoi_status: z.literal("not_applied"),
  coverage_status: z.literal("unknown"),
  start_date: day,
  end_date: day,
  scope: z.literal("brazil_download"),
  declared_download_area: z.literal("Brazil"),
  sources: z.object({ modis: sourceSchema, viirs: sourceSchema }),
  notice: z.string().min(1),
  pantanal: pantanalSchema.optional(),
});
export type ReviewManifest = z.infer<typeof manifestSchema>;
// [original CSV record, lon, lat, UTC time, platform, FRP MW, raw confidence, type]
export const reviewPointSchema = z.tuple([
  z.number().int().positive(),
  z.number().min(-180).max(180),
  z.number().min(-90).max(90),
  z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\dZ$/),
  z.enum(["Terra", "Aqua", "S-NPP"]),
  z.number().nonnegative(),
  z.string(),
  z.enum(["0", "1", "2", "3"]).nullable(),
]);
export type ReviewPoint = z.infer<typeof reviewPointSchema>;
export type DatedReviewPoint = { date: string; point: ReviewPoint };

export function datesBetween(start: string, end: string): string[] {
  if (!isSelectionDate(start) || !isSelectionDate(end) || start > end)
    throw Error("Invalid review date range.");
  const length = (Date.parse(end) - Date.parse(start)) / 86400000 + 1;
  if (length > 367) throw Error("Review date range is too long.");
  return Array.from({ length }, (_, i) =>
    new Date(Date.parse(start) + i * 86400000).toISOString().slice(0, 10),
  );
}

export function parseReviewManifest(value: unknown): ReviewManifest {
  const manifest = manifestSchema.parse(value);
  const dates = datesBetween(manifest.start_date, manifest.end_date);
  for (const key of reviewSources) {
    const source = manifest.sources[key];
    if (
      source.source_dataset !==
        (key === "modis" ? "MODIS_SP" : "VIIRS_SNPP_SP") ||
      source.days.length !== dates.length ||
      source.days.some(
        (item, i) =>
          item.date !== dates[i] || item.path !== `${key}/${item.date}.json`,
      ) ||
      source.days.reduce((sum, item) => sum + item.count, 0) !==
        source.record_count
    )
      throw Error(
        "Review source, dates, paths or record counts are inconsistent.",
      );
  }
  if (manifest.pantanal) {
    if (manifest.pantanal.boundary.path !== "pantanal/boundary.json")
      throw Error("Invalid regional boundary path.");
    for (const key of reviewSources) {
      const regional = manifest.pantanal.sources[key],
        national = manifest.sources[key];
      if (
        regional.record_count > national.record_count ||
        regional.boundary_record_count > regional.record_count ||
        regional.days.length !== dates.length ||
        regional.days.some(
          (item, i) =>
            item.date !== dates[i] ||
            item.path !== `pantanal/${key}/${item.date}.json` ||
            item.count > national.days[i].count,
        ) ||
        regional.days.reduce((sum, item) => sum + item.count, 0) !==
          regional.record_count ||
        regional.input_sha256 !== national.input_sha256 ||
        regional.input_file !== national.input_file ||
        JSON.stringify(regional.collection_values) !==
          JSON.stringify(national.collection_values) ||
        regional.source_dataset !== national.source_dataset ||
        regional.request_id !== national.request_id ||
        regional.normalization_version !== national.normalization_version
      )
        throw Error(
          "Regional metadata is inconsistent with the national source.",
        );
    }
  }
  return manifest;
}

export function parseReviewDay(
  value: unknown,
  source: ReviewSource,
  date: string,
  expectedCount: number,
): DatedReviewPoint[] {
  const data = z
    .object({
      schema_version: z.literal("detection-review/1.0.0"),
      source: z.enum(reviewSources),
      date: day,
      points: z.array(reviewPointSchema),
    })
    .parse(value);
  const ids = new Set<number>();
  if (
    data.source !== source ||
    data.date !== date ||
    data.points.length !== expectedCount
  )
    throw Error("Detection file does not match its manifest.");
  for (const point of data.points) {
    if (
      ids.has(point[0]) ||
      (source === "modis" ? point[4] === "S-NPP" : point[4] !== "S-NPP")
    )
      throw Error("Duplicate record reference or mismatched platform.");
    const confidence = point[6].trim();
    if (
      source === "modis"
        ? confidence === "" ||
          !Number.isFinite(Number(confidence)) ||
          Number(confidence) < 0 ||
          Number(confidence) > 100
        : !["l", "low", "n", "nominal", "h", "high"].includes(
            confidence.toLowerCase(),
          )
    )
      throw Error("Invalid source confidence.");
    ids.add(point[0]);
  }
  return data.points.map((point) => ({ date, point }));
}

export async function checkedAsset(
  item: { path: string; sha256: string; bytes: number },
  signal?: AbortSignal,
): Promise<unknown> {
  if (
    !/^(?:(?:pantanal\/)?(?:modis|viirs)\/\d{4}-\d{2}-\d{2}\.json|pantanal\/boundary\.json)$/.test(
      item.path,
    )
  )
    throw Error("Invalid review asset path.");
  if (!globalThis.crypto?.subtle)
    throw Error("Use HTTPS or localhost to verify detection files securely.");
  const response = await fetch(
    REVIEW_ROOT + item.path + "?sha256=" + item.sha256,
    {
      signal,
      cache: "force-cache",
    },
  );
  if (!response.ok)
    throw Error("A review data file is unavailable. Please retry.");
  const bytes = await response.arrayBuffer();
  const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
  if (bytes.byteLength !== item.bytes || hash !== item.sha256)
    throw Error("Review file integrity check failed. Please reload or retry.");
  return JSON.parse(new TextDecoder().decode(bytes));
}

export async function loadReviewManifest(signal?: AbortSignal) {
  const response = await fetch(REVIEW_ROOT + "manifest.json", {
    signal,
    cache: "no-cache",
  });
  if (!response.ok) throw Error("The detection review dataset is unavailable.");
  return parseReviewManifest(await response.json());
}

export async function loadReviewPoints(
  manifest: ReviewManifest,
  source: ReviewSource,
  start: string,
  end: string,
  signal?: AbortSignal,
  region: ReviewRegion = "brazil",
) {
  if (start < manifest.start_date || end > manifest.end_date)
    throw Error("Choose dates inside the delivered review window.");
  const days = datesBetween(start, end);
  const results = await Promise.all(
    days.map(async (date) => {
      const item = reviewSourceInfo(manifest, source, region).days.find(
        (item) => item.date === date,
      )!;
      return parseReviewDay(
        await checkedAsset(item, signal),
        source,
        date,
        item.count,
      );
    }),
  );
  const rows = results.flat();
  if (new Set(rows.map((row) => row.point[0])).size !== rows.length)
    throw Error("A source record is repeated across detection files.");
  return rows.sort((a, b) => a.point[0] - b.point[0]);
}

export type ReviewSelection = {
  region: ReviewRegion;
  source: ReviewSource;
  start: string;
  end: string;
  satellite: string;
  imagery: boolean;
};
export function resolveReviewSelection(
  search: string,
  manifest: ReviewManifest,
): { selection: ReviewSelection; corrected: boolean } {
  const params = new URLSearchParams(search);
  const region =
    params.get("raw_region") === "pantanal" && manifest.pantanal
      ? "pantanal"
      : "brazil";
  const source = params.get("raw_source") === "modis" ? "modis" : "viirs";
  const valid = (value: string | null): value is string =>
    !!value &&
    isSelectionDate(value) &&
    value >= manifest.start_date &&
    value <= manifest.end_date;
  const start = valid(params.get("raw_from"))
    ? params.get("raw_from")!
    : manifest.start_date;
  let end = valid(params.get("raw_to")) ? params.get("raw_to")! : start;
  if (end < start) end = start;
  const platforms = source === "modis" ? ["Terra", "Aqua"] : ["S-NPP"];
  const satellite = platforms.includes(params.get("raw_satellite") ?? "")
    ? params.get("raw_satellite")!
    : "all";
  const selection: ReviewSelection = {
    region,
    source,
    start,
    end,
    satellite,
    imagery: params.get("raw_imagery") === "1",
  };
  const normalized = new URLSearchParams(
    reviewSelectionSearch(search, selection),
  );
  const corrected = [
    "raw_region",
    "raw_source",
    "raw_from",
    "raw_to",
    "raw_satellite",
    "raw_imagery",
  ].some(
    (key) =>
      params.has(key) &&
      (params.getAll(key).length > 1 ||
        params.get(key) !== normalized.get(key)),
  );
  return { selection, corrected };
}
export function reviewSelectionSearch(
  search: string,
  selection: ReviewSelection,
) {
  const params = new URLSearchParams(search);
  for (const [key, value] of Object.entries({
    raw_region: selection.region,
    raw_source: selection.source,
    raw_from: selection.start,
    raw_to: selection.end,
    raw_satellite: selection.satellite,
    raw_imagery: selection.imagery ? "1" : "0",
  }))
    params.set(key, value);
  return "?" + params.toString();
}

export type MapGroup = {
  longitude: number;
  latitude: number;
  rows: DatedReviewPoint[];
};
/** Screen-grid grouping only; not a fire-event or scientific spatial aggregation. */
export function groupReviewPoints(
  rows: DatedReviewPoint[],
  zoom: number,
): MapGroup[] {
  if (zoom >= 10)
    return rows.map((row) => ({
      longitude: row.point[1],
      latitude: row.point[2],
      rows: [row],
    }));
  const scale = 256 * 2 ** Math.floor(zoom);
  const groups = new Map<string, MapGroup>();
  for (const row of rows) {
    const [, lon, lat] = row.point;
    const sin = Math.sin((Math.max(-85, Math.min(85, lat)) * Math.PI) / 180);
    const x = ((lon + 180) / 360) * scale;
    const y = (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale;
    const key = `${Math.floor(x / 54)},${Math.floor(y / 54)}`;
    const group = groups.get(key) ?? { longitude: 0, latitude: 0, rows: [] };
    group.longitude += lon;
    group.latitude += lat;
    group.rows.push(row);
    groups.set(key, group);
  }
  return [...groups.values()].map((group) => ({
    longitude: group.longitude / group.rows.length,
    latitude: group.latitude / group.rows.length,
    rows: group.rows,
  }));
}

export function reviewSourceInfo(
  manifest: ReviewManifest,
  source: ReviewSource,
  region: ReviewRegion,
) {
  if (region === "pantanal") {
    if (!manifest.pantanal) throw Error("The Pantanal subset is unavailable.");
    return manifest.pantanal.sources[source];
  }
  return manifest.sources[source];
}
const position = z.tuple([
  z.number().min(-180).max(180),
  z.number().min(-90).max(90),
]);
const ring = z
  .array(position)
  .min(4)
  .max(100000)
  .refine(
    (points) =>
      points[0][0] === points.at(-1)![0] && points[0][1] === points.at(-1)![1],
  );
export const reviewBoundarySchema = z.object({
  type: z.literal("Feature"),
  properties: z.object({
    source: z.literal("IBGE"),
    edition: z.literal("2025"),
    name: z.literal("Pantanal"),
  }),
  geometry: z.discriminatedUnion("type", [
    z.object({ type: z.literal("Polygon"), coordinates: z.array(ring).min(1) }),
    z.object({
      type: z.literal("MultiPolygon"),
      coordinates: z.array(z.array(ring).min(1)).min(1),
    }),
  ]),
});
export type ReviewBoundary = z.infer<typeof reviewBoundarySchema>;
