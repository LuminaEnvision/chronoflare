import { parseArgs } from "node:util";
import { buildAnnualComparison } from "../app/src/data/annual-comparison";
import { bases } from "../app/src/data/selection";
import { readLocalDataset } from "./local-dataset";
import { writeComparisonOutput } from "./comparison-output";

try {
  const { values } = parseArgs({
    options: {
      basis: { type: "string" },
      years: { type: "string" },
      output: { type: "string" },
      help: { type: "boolean" },
    },
  });
  if (values.help) {
    console.log(
      "Usage: npm run data:compare -- --basis viirs|modis|harmonized --years YYYY,YYYY [--output science/outputs/comparison.json]",
    );
  } else {
    const basis = bases.find((value) => value === values.basis);
    if (!basis || !values.years || !/^\d{4},\d{4}$/.test(values.years))
      throw Error(
        "Provide --basis and two comma-separated four-digit years with --years.",
      );
    const years = values.years.split(",").map(Number) as [number, number];
    const comparison = buildAnnualComparison(await readLocalDataset(), {
      basis,
      years,
    });
    if (values.output) {
      await writeComparisonOutput(values.output, comparison);
    }
    console.log(
      JSON.stringify(
        {
          datasetVersion: comparison.datasetVersion,
          dataStatus: comparison.dataStatus,
          basis: comparison.basis,
          metricName: comparison.metricName,
          years: comparison.series.map(({ year, counts }) => ({
            year,
            ...counts,
          })),
          valueExtent: comparison.valueExtent,
          outputWritten: Boolean(values.output),
          notice: comparison.notice,
        },
        null,
        2,
      ),
    );
  }
} catch (error) {
  console.error(
    `Comparison failed: ${error instanceof Error ? error.message : "Unknown error"}`,
  );
  process.exitCode = 1;
}
