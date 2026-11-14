import { dataAssetPathSchema, manifestSchema, parseDataset } from "./schema";
async function json(path: string) {
  dataAssetPathSchema.parse(path);
  const response = await fetch(path, { cache: "no-cache" });
  if (!response.ok) throw Error(`Arquivo indisponível: ${path}`);
  return response.json();
}
export async function loadDataset() {
  const manifest = manifestSchema.parse(await json("/data/v1/manifest.json"));
  const [calendar, validation] = await Promise.all([
    json(manifest.files.calendar_day),
    json(manifest.files.validation),
  ]);
  return parseDataset(manifest, calendar, validation);
}
export function calendarSlot(date: string) {
  const [, m, d] = date.split("-").map(Number);
  return Math.round(
    (Date.UTC(2000, m - 1, d) - Date.UTC(2000, 0, 1)) / 86400000,
  );
}
