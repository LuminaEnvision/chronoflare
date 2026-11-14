import { readFile } from "node:fs/promises";
import { manifestSchema, parseDataset } from "../app/src/data/schema";
const read = async (path: string) =>
  JSON.parse(await readFile("app/public" + path, "utf8"));
const manifest = manifestSchema.parse(await read("/data/v1/manifest.json"));
const dataset = parseDataset(
  manifest,
  await read(manifest.files.calendar_day),
  await read(manifest.files.validation),
);
if (process.argv.includes("--real") && dataset.manifest.data_status !== "real")
  throw Error("Scientific publication requires real data");
console.log(
  `${dataset.calendar.records.length} valid records; status=${dataset.manifest.data_status}; decision=${dataset.manifest.decision}`,
);
