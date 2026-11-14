import { readLocalDataset } from "./local-dataset";
const dataset = await readLocalDataset();
if (process.argv.includes("--real") && dataset.manifest.data_status !== "real")
  throw Error("Scientific publication requires real data");
console.log(
  `${dataset.calendar.records.length} valid records; status=${dataset.manifest.data_status}; decision=${dataset.manifest.decision}`,
);
