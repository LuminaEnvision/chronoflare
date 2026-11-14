import { z } from "zod";
import {
  solarAssetPath,
  solarPlatforms,
  solarPreviewSchema,
  type SolarPreview,
  type SolarPlatform,
} from "./experimental-solar";

const root = "/data/experimental/records-v1/";
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const day = z.string().regex(/^2020-08-(0[1-9]|1[0-5])$/);
const entrySchema = z.object({
  path: z.string().regex(/^(terra|aqua|snpp)\/2020-08-(0[1-9]|1[0-5])\.json$/),
  sha256: hash,
  bytes: z.number().int().positive().max(4000000),
  solar_date: day,
  platform: z.enum(solarPlatforms),
  record_count: z.number().int().nonnegative(),
  proposed_filter_count: z.number().int().nonnegative(),
});
export const recordManifestSchema = z.object({
  schema_version: z.literal("solar-record-manifest/1.0.0"),
  status: z.literal("real_unreviewed"),
  preview_sha256: hash,
  quality_rule: z.unknown(),
  record_count: z.number().int().nonnegative(),
  entries: z.array(entrySchema).length(45),
});
export type RecordEntry = z.infer<typeof entrySchema>;
const recordSchema = z.object({
  request_id: z.string().regex(/^(modis|viirs)-(1|6|11|16)$/),
  source_record: z.number().int().positive(),
  source_file_sha256: hash,
  acquired_at_utc: z.string().datetime(),
  longitude: z.number().min(-180).max(180),
  latitude: z.number().min(-90).max(90),
  frp_mw: z.number().finite().nonnegative(),
  confidence_raw: z.string(),
  source_type: z.enum(["0", "1", "2", "3"]).nullable(),
  candidate_quality_pass: z.boolean(),
  candidate_quality_reasons: z.array(
    z.enum(["missing_source_type", "nonzero_source_type", "low_confidence"]),
  ),
});
const shardSchema = z.object({
  schema_version: z.literal("solar-records/1.0.0"),
  solar_date: day,
  platform: z.enum(solarPlatforms),
  period_start_utc: z.string(),
  period_end_utc_exclusive: z.string(),
  records: z.array(recordSchema),
});
export type SolarRecord = z.infer<typeof recordSchema>;
export const recordId = (row: SolarRecord) =>
  `${row.source_file_sha256}:${row.source_record}`;
export function validateRecordManifest(input: unknown, preview: SolarPreview) {
  const manifest = recordManifestSchema.parse(input);
  if (
    JSON.stringify(manifest.quality_rule) !==
    JSON.stringify(preview.quality_rule)
  )
    throw Error("Record quality rules differ from the calendar snapshot.");
  const slugs = { Terra: "terra", Aqua: "aqua", "S-NPP": "snpp" };
  const keys = new Set<string>();
  for (const entry of manifest.entries) {
    const key = `${entry.solar_date}|${entry.platform}`;
    const cell = preview.records.find(
      (row) =>
        row.solar_date === entry.solar_date && row.platform === entry.platform,
    );
    if (
      keys.has(key) ||
      !cell ||
      entry.path !== `${slugs[entry.platform]}/${entry.solar_date}.json` ||
      entry.record_count !== (cell.all_detections.detection_count ?? 0) ||
      entry.proposed_filter_count !==
        (cell.proposed_filter.detection_count ?? 0)
    )
      throw Error("Record manifest does not reconcile with calendar cells.");
    keys.add(key);
  }
  if (
    manifest.entries.reduce((sum, entry) => sum + entry.record_count, 0) !==
    manifest.record_count
  )
    throw Error("Record manifest total is inconsistent.");
  return manifest;
}
export function parseSolarRecords(
  input: unknown,
  entry: RecordEntry,
  preview: SolarPreview,
) {
  const shard = shardSchema.parse(input);
  const cell = preview.records.find(
    (row) =>
      row.solar_date === entry.solar_date && row.platform === entry.platform,
  )!;
  if (
    !cell ||
    shard.solar_date !== cell.solar_date ||
    shard.platform !== cell.platform ||
    shard.period_start_utc !== cell.period_start_utc ||
    shard.period_end_utc_exclusive !== cell.period_end_utc_exclusive ||
    shard.records.length !== entry.record_count
  )
    throw Error("Record shard does not match its calendar cell.");
  const source = entry.platform === "S-NPP" ? "VIIRS_SNPP_SP" : "MODIS_SP";
  const prefix = entry.platform === "S-NPP" ? "viirs" : "modis";
  const ids = new Set<string>();
  for (const row of shard.records) {
    const stamp = Date.parse(row.acquired_at_utc);
    const provenance = preview.provenance.find(
      (item) =>
        item.sha256 === row.source_file_sha256 && item.source === source,
    );
    const reasons: string[] = [];
    if (row.source_type === null) reasons.push("missing_source_type");
    else if (row.source_type !== "0") reasons.push("nonzero_source_type");
    const confidence = row.confidence_raw.trim().toLowerCase();
    if (source === "MODIS_SP") {
      if (!/^\d+(?:\.\d+)?$/.test(confidence) || Number(confidence) > 100)
        throw Error("Invalid MODIS confidence.");
      if (Number(confidence) < 30) reasons.push("low_confidence");
    } else {
      if (!["l", "low", "n", "nominal", "h", "high"].includes(confidence))
        throw Error("Invalid VIIRS confidence.");
      if (["l", "low"].includes(confidence)) reasons.push("low_confidence");
    }
    if (
      ids.has(recordId(row)) ||
      !provenance ||
      row.source_record > provenance.row_count ||
      row.request_id !==
        `${prefix}-${Number(provenance.requested_start_utc.slice(-2))}` ||
      row.acquired_at_utc.slice(0, 10) < provenance.requested_start_utc ||
      row.acquired_at_utc.slice(0, 10) >
        provenance.requested_end_utc_inclusive ||
      stamp < Date.parse(cell.period_start_utc) ||
      stamp >= Date.parse(cell.period_end_utc_exclusive) ||
      row.candidate_quality_pass !== (reasons.length === 0) ||
      row.candidate_quality_reasons.join("|") !== reasons.join("|")
    )
      throw Error(
        "Record lineage, solar window or proposed quality result is inconsistent.",
      );
    ids.add(recordId(row));
  }
  const filtered = shard.records.filter((row) => row.candidate_quality_pass);
  for (const [rows, totals] of [
    [shard.records, cell.all_detections],
    [filtered, cell.proposed_filter],
  ] as const) {
    const sum = rows.reduce((value, row) => value + row.frp_mw, 0);
    if (
      rows.length !== (totals.detection_count ?? 0) ||
      Math.abs(sum - (totals.raw_frp_sum_mw ?? 0)) > 0.000001
    )
      throw Error("Inspected rows do not reproduce the displayed totals.");
  }
  return shard.records;
}
export async function digest(bytes: ArrayBuffer) {
  if (!globalThis.crypto?.subtle)
    throw Error("Use HTTPS or localhost to verify source records securely.");
  return Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
}
async function bytes(path: string, maximum: number, signal: AbortSignal) {
  const response = await fetch(path, { cache: "no-cache", signal });
  if (!response.ok)
    throw Error("Source records could not be loaded. Please retry.");
  const data = await response.arrayBuffer();
  if (data.byteLength > maximum)
    throw Error("Source record response exceeds its supported size.");
  return data;
}
export async function loadSolarRecords(
  preview: SolarPreview,
  platform: SolarPlatform,
  date: string,
  signal: AbortSignal,
) {
  const decode = (data: ArrayBuffer) =>
    JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(data));
  const [manifestBytes, previewBytes] = await Promise.all([
    bytes(root + "manifest.json", 100000, signal),
    bytes(solarAssetPath, 200000, signal),
  ]);
  const manifest = validateRecordManifest(decode(manifestBytes), preview);
  if (
    (await digest(previewBytes)) !== manifest.preview_sha256 ||
    JSON.stringify(solarPreviewSchema.parse(decode(previewBytes))) !==
      JSON.stringify(preview)
  )
    throw Error(
      "Records belong to a different calendar snapshot. Reload the page.",
    );
  const entry = manifest.entries.find(
    (item) => item.platform === platform && item.solar_date === date,
  );
  if (!entry)
    throw Error("No source shard exists for this solar day and platform.");
  const payload = await bytes(root + entry.path, entry.bytes, signal);
  if (
    payload.byteLength !== entry.bytes ||
    (await digest(payload)) !== entry.sha256
  )
    throw Error("Source record integrity check failed.");
  return parseSolarRecords(decode(payload), entry, preview);
}
