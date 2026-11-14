import { readFile } from "node:fs/promises";
import { manifestSchema, parseDataset } from "../app/src/data/schema";

/** CLI counterpart of the browser loader; referenced paths are schema-validated. */
export async function readLocalDataset() {
  const read = async (path: string) =>
    JSON.parse(await readFile("app/public" + path, "utf8"));
  const manifest = manifestSchema.parse(await read("/data/v1/manifest.json"));
  const [calendar, validation] = await Promise.all([
    read(manifest.files.calendar_day),
    read(manifest.files.validation),
  ]);
  return parseDataset(manifest, calendar, validation);
}
