import { mkdir, realpath, writeFile } from "node:fs/promises";
import {
  basename,
  dirname,
  isAbsolute,
  relative,
  resolve,
  sep,
} from "node:path";
import type { AnnualComparison } from "../app/src/data/annual-comparison";

async function resolvedDestination(path: string) {
  let ancestor = resolve(path);
  const tail: string[] = [];
  for (;;) {
    try {
      return resolve(await realpath(ancestor), ...tail.reverse());
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      const parent = dirname(ancestor);
      if (parent === ancestor) throw error;
      tail.push(basename(ancestor));
      ancestor = parent;
    }
  }
}

/** Inspection output is opt-in, never overwrites files, and stays outside frontend trees. */
export async function writeComparisonOutput(
  path: string,
  comparison: AnnualComparison,
) {
  const output = await resolvedDestination(path);
  for (const directory of ["app", "dist"]) {
    const root = await resolvedDestination(directory);
    const target = relative(root, output);
    if (
      !target ||
      (target !== ".." && !target.startsWith(".." + sep) && !isAbsolute(target))
    ) {
      throw Error(
        "Comparison inspection output cannot be written into app/ or dist/.",
      );
    }
  }
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(comparison, null, 2) + "\n", {
    flag: "wx",
  });
}
