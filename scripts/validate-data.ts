import { readFile } from "node:fs/promises";
import { parseDataset } from "../app/src/data/schema";
const read = async (path: string) =>
  JSON.parse(await readFile("app/public" + path, "utf8"));
const manifest = await read("/data/v1/manifest.json");
const dataset = parseDataset(
  manifest,
  await read(manifest.files.calendar_day),
  await read(manifest.files.validation),
);
if (process.argv.includes("--real") && dataset.manifest.data_status !== "real")
  throw Error("Publicação científica exige dados reais");
console.log(
  `${dataset.calendar.records.length} registros válidos; status=${dataset.manifest.data_status}; decisão=${dataset.manifest.decision}`,
);
