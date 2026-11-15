import { z } from "zod";
import { approvedModelHash, isCivilDate } from "./observations";

export const sampleRoles = [
  "independent_holdout",
  "post_hoc_examined_holdout",
  "training_window_in_sample",
] as const;
export type SampleRole = (typeof sampleRoles)[number];
export const roleNames: Record<SampleRole, string> = {
  independent_holdout: "Independent test",
  post_hoc_examined_holdout: "Previously examined",
  training_window_in_sample: "Training period",
};
export const roleNotes: Record<SampleRole, string> = {
  independent_holdout:
    "Registered before acquisition; the validation evidence.",
  post_hoc_examined_holdout:
    "Examined before v2 was designed; descriptive only.",
  training_window_in_sample:
    "The model was fitted here; agreement is not evidence.",
};
const positive = z.number().finite().positive();
const row = z
  .object({
    date: z.string().refine(isCivilDate),
    estimate_mw: positive,
    lower_mw: z.number().finite().nonnegative(),
    upper_mw: z.number().finite().nonnegative(),
    snpp_mw: positive.nullable(),
    benchmark_mw: positive,
    role: z.enum(sampleRoles),
    extrapolated: z.boolean(),
  })
  .refine((r) => r.lower_mw <= r.upper_mw, "Interval is inverted");
export const harmonizationPairsSchema = z
  .object({
    schema_version: z.literal("harmonization-pairs/1.0.0"),
    model_sha256: z.literal(approvedModelHash),
    weights: z.object({
      Terra: z.number().min(0).max(1),
      Aqua: z.number().min(0).max(1),
    }),
    provenance: z
      .array(
        z.object({
          path: z.string().regex(/^(?:docs|app\/public)\/[a-zA-Z0-9/_\-.]+$/),
          sha256: z.string().regex(/^[a-f0-9]{64}$/),
        }),
      )
      .min(2),
    rows: z.array(row).min(1),
  })
  .superRefine((value, ctx) => {
    let previous = "";
    for (const r of value.rows) {
      if (r.date <= previous)
        ctx.addIssue({
          code: "custom",
          message: "Dates must be unique and sorted",
        });
      previous = r.date;
    }
    if (Math.abs(value.weights.Terra + value.weights.Aqua - 1) > 1e-9)
      ctx.addIssue({ code: "custom", message: "Weights must be convex" });
  });
export type HarmonizationPairs = z.infer<typeof harmonizationPairsSchema>;
export type PairRow = HarmonizationPairs["rows"][number];

export async function loadHarmonizationPairs(signal?: AbortSignal) {
  const response = await fetch("/data/harmonization-pairs.json", { signal });
  if (!response.ok) throw new Error("Paired comparison data is unavailable");
  return harmonizationPairsSchema.parse(await response.json());
}

/** Only dates with an S-NPP reference can be compared; the rest stay unavailable. */
export function pairedRows(rows: PairRow[]) {
  return rows.filter(
    (r): r is PairRow & { snpp_mw: number } => r.snpp_mw !== null,
  );
}

export function roleCounts(rows: PairRow[]) {
  return sampleRoles.map((role) => {
    const members = rows.filter((r) => r.role === role);
    return {
      role,
      published: members.length,
      paired: pairedRows(members).length,
      withoutReference: members.length - pairedRows(members).length,
    };
  });
}

/** Powers of ten covering every plotted value, shared by both axes and both panels. */
export function logDomain(values: number[]) {
  const usable = values.filter((v) => Number.isFinite(v) && v > 0);
  if (!usable.length) throw new Error("No positive value to plot");
  const low = Math.floor(Math.log10(Math.min(...usable)));
  const high = Math.ceil(Math.log10(Math.max(...usable)));
  return { low, high: Math.max(high, low + 1) };
}

export function logPosition(
  value: number,
  domain: { low: number; high: number },
) {
  return (Math.log10(value) - domain.low) / (domain.high - domain.low);
}
