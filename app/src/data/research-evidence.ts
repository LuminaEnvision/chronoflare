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
    publication: z.object({
      total_days: z.number().int().positive(),
      by_year: z.record(
        z.string().regex(/^20\d\d$/),
        z.number().int().nonnegative(),
      ),
      by_sample_role: z.object({
        training_window_in_sample: z.number().int().nonnegative(),
        post_hoc_examined_holdout: z.number().int().nonnegative(),
        independent_holdout: z.number().int().nonnegative(),
      }),
      extrapolated_days: z.number().int().nonnegative(),
      roles_by_date: z.record(
        z.string().regex(/^20\d\d-\d\d-\d\d$/),
        z.enum([
          "training_window_in_sample",
          "post_hoc_examined_holdout",
          "independent_holdout",
        ]),
      ),
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
      Object.keys(r.publication.roles_by_date).length !==
        r.publication.total_days ||
      Object.values(r.publication.by_year).reduce((a, b) => a + b, 0) !==
        r.publication.total_days ||
      Object.values(r.publication.by_sample_role).reduce((a, b) => a + b, 0) !==
        r.publication.total_days
    )
      ctx.addIssue({
        code: "custom",
        message: "Publication support does not reconcile",
      });
    for (const [role, count] of Object.entries(r.publication.by_sample_role))
      if (
        Object.values(r.publication.roles_by_date).filter((v) => v === role)
          .length !== count
      )
        ctx.addIssue({
          code: "custom",
          message: "Publication roles do not reconcile",
        });
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

export const sampleRoleLabels: Record<string, string> = {
  training_window_in_sample:
    "Training period · agreement is not validation evidence",
  post_hoc_examined_holdout: "Previously examined date · post-hoc evidence",
  independent_holdout: "Date from the registered independent holdout",
};
export async function loadResearchEvidence(signal?: AbortSignal) {
  const response = await fetch("/data/research-summary.json", { signal });
  if (!response.ok) throw new Error("Research evidence is unavailable");
  return researchEvidenceSchema.parse(await response.json());
}
