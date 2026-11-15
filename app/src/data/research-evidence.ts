import { z } from "zod";
import { approvedModelHash } from "./observations";
const metrics = z.object({
  paired_days: z.number().int().positive(),
  weekly: z.object({
    weeks: z.number().int().positive(),
    spearman: z.number().min(-1).max(1),
    pbias: z.number().finite(),
    mae: z.number().nonnegative(),
    relative_mae: z.number().nonnegative(),
  }),
  naive: z.object({
    spearman: z.number().min(-1).max(1),
    pbias: z.number().finite(),
    mae: z.number().nonnegative(),
    relative_mae: z.number().nonnegative(),
  }),
  picp_daily: z.number().min(0).max(1),
  median_relative_width: z.number().nonnegative(),
  checks: z.record(z.string(), z.boolean()),
});
export const researchEvidenceSchema = z
  .object({
    schema_version: z.literal("research-evidence/1.0.0"),
    v1: z.object({
      model_sha256: z.string().length(64),
      decision: z.literal("plan_b"),
      combined_forward: metrics,
    }),
    v2: z.object({
      model_sha256: z.literal(approvedModelHash),
      evaluation_kind: z.literal(
        "independent_holdout_registered_before_acquisition",
      ),
      registered_at_utc: z.iso.datetime(),
      completed_blocks: z.number().int().positive(),
      missing_blocks: z.literal(0),
      combined_forward: metrics,
      paired_days_by_year: z.record(
        z.string().regex(/^20\d\d$/),
        z.number().int().positive(),
      ),
      independent_backward_validation: z.literal(false),
    }),
    provenance: z
      .array(
        z.object({
          path: z
            .string()
            .regex(/^docs\/[a-zA-Z0-9/_\-.]+$/)
            .refine((p) => !p.includes("..")),
          sha256: z.string().regex(/^[a-f0-9]{64}$/),
        }),
      )
      .min(2),
  })
  .superRefine((r, ctx) => {
    if (
      Object.values(r.v2.paired_days_by_year).reduce((a, b) => a + b, 0) !==
        r.v2.combined_forward.paired_days ||
      !Object.values(r.v2.combined_forward.checks).every(Boolean)
    )
      ctx.addIssue({
        code: "custom",
        message: "Independent support or registered checks do not reconcile",
      });
  });
export type ResearchEvidence = z.infer<typeof researchEvidenceSchema>;
