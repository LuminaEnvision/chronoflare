import { parseDataset } from "./schema";
async function json(path: string) {
  if (!path.startsWith("/data/v1/"))
    throw Error("Asset fora do diretório de dados");
  const response = await fetch(path);
  if (!response.ok) throw Error(`Arquivo indisponível: ${path}`);
  return response.json();
}
export async function loadDataset() {
  const manifest = await json("/data/v1/manifest.json");
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
