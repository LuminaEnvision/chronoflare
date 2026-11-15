# Delivery 5 method review and existing experiment evidence

Delivery `method.md` (`v1.0-handoff-5`, methodology `1.2.0`) was reviewed as a
scientific specification, not as evidence that the implementation or scientific
approval is complete. The supplied document declares registration at
2026-11-15T14:28:00Z. Its hash and the review status are recorded in
[machine-readable provenance](multiyear-evidence/method-handoff-review.json).
The attachment is not installed as executable instructions.

## Decision supported by existing evidence

The historical frozen candidate selects **Plan B** and `harmonization_approved=false`.
This is the outcome of engine `loyo-calibration/1.0.0`, not a completed evaluation
of all Delivery 5 rules. Existing metrics and frozen artifacts remain unchanged.
The source and model hashes are in the review receipt and original experiment
report. Actions run [43719416857](https://github.com/j-c-fstk-dev/chronoflare/actions/runs/43719416857)
contains the full evaluation evidence.

| Experiment | View | Paired days / eligible weeks | Weekly Spearman | Weekly PBias | Weekly MAE (MW) | Daily PICP80 | Median relative width |
| --- | --- | --- | --- | --- | --- | --- | --- |
| forward_validation_primary | Terra_only | 239 / 24 | 0.806957 | -41.28% | 8841.0403 | 0.736402 | 2.180515 |
| forward_validation_primary | Aqua_only | 209 / 20 | 0.906767 | -32.80% | 7744.8987 | 0.741627 | 1.372665 |
| forward_validation_primary | Combined_Terra_Aqua | 286 / 25 | 0.866923 | -36.58% | 7164.8183 | 0.709790 | 1.135305 |
| backward_transfer_validation | Terra_only | 313 / 20 | 0.933835 | +22.77% | 2010.8413 | 0.718850 | 2.608666 |
| backward_transfer_validation | Aqua_only | 254 / 14 | 0.956044 | +5.04% | 839.6849 | 0.748031 | 1.197725 |
| backward_transfer_validation | Combined_Terra_Aqua | 424 / 34 | 0.918411 | +16.45% | 883.5998 | 0.757075 | 3.064229 |

Weekly errors use means over matched valid paired days, with at least five such
days per eligible ISO week. Interval coverage is daily; weekly PICP is not defined
by the existing interval recipe. Width is dimensionless. The combined forward
candidate fails PBias and strict MAE improvement over the same-cohort naive
benchmark (7,164.8183 versus 4,716.0188 MW). The combined backward candidate passes
its registered checks; this cannot override forward failure. Individual views
also have failed checks, including insufficient eligible weeks in some views;
see their full `checks` dictionaries in the original report.

## Material differences from the executed engine

1. **EQM upper tail (section 3.2).** Delivery 5 requires linear proportional
   extrapolation above Q99. The frozen engine uses `outside_range=clamp_to_endpoint`
   in `science/scripts/calibration_models.py`. This is a confirmed implementation
   difference and a plausible contributor to underestimated extremes. Its size
   and causal contribution have not been measured. Do not relabel old models as
   compliant or replace their predictions in place.
2. **Training-only model eligibility (section 3.2).** The existing selector ranks
   pooled LOYO out-of-fold MAE and prefers median ratio on exact ties. On an
   identical positive reference cohort, minimizing MAE and relative MAE gives the
   same ranking. However, the new explicit training PBias constraint is not
   enforced during candidate selection. The document does not specify whether
   this constraint applies per fold or to pooled OOF predictions, or what to do
   if both candidates fail. Until resolved, a conservative new implementation
   must block that stratum rather than silently choose an ineligible candidate.
3. **Historical calendar statistics (section 5).** The eight-other-year seasonal
   baseline, zero-dispersion fallbacks, three-consecutive-day anomaly runs and
   annual season-window eligibility are new implementation work. No historical
   anomaly or season-window result is approved by receipt of this document.
4. **Requested versus acquired scope.** Inputs cover 2,450 requested solar dates:
   2012-01-20 through 2015-12-31, plus fixed wet/dry windows in 2017–2024.
   There are no acquired 2016, 2025 or 2026 observations in this experiment and
   no pre-2012 estimates. The template dataset label `2000-2026` would overstate
   the executed dataset. Positive-only records still do not prove observation
   coverage; missing records remain null, never inferred zeros.
5. **Not all prescribed diagnostics exist.** Annual orbital-drift review through
   2026, H3 r6 map aggregation and the NRT static-source mask are not certified by
   the existing SP-only experiment. SP filtering, exact post-quality duplicate
   removal and platform/turn aggregation are already implemented. No NRT input
   should be silently admitted under the new masking rule before implementation.

The existing complete-turn requirement, training-only LOYO fitting, availability-
regime/season residual intervals and 1.25 pre-overlap interval-inflation helper
are compatible in purpose with the handoff. Availability of a helper is not proof
of pre-2012 validation or complete end-to-end Delivery 5 execution.

## Versioning and review sequence

The registered thresholds receipt declares 2026-11-15T01:57:00Z. The historical
model freeze receipt is 2026-11-15T13:35:49.800991Z, before this method document's
14:28:00Z registration. The new tail and selection rules therefore cannot be
represented as preregistered rules for that historical fit.

Implement any revised method under a new engine/method identifier and preserve
the old report, source hashes and model bytes. Resolve deterministic ambiguities,
add focused tests, choose models/weights/intervals within training data and freeze
new parameters before scoring. The existing holdout has already been inspected:
a rerun on it is a revised-method evaluation on a previously seen holdout, not a
new untouched confirmatory test. Document that limitation and any fresh-data
protocol; do not tune rules to force Plan A or weaken registered thresholds.

Before a future baseline calculation, specify the exact circular non-leap
month/day mapping: the stated Feb 29 inclusion interval and “31 civil days” can
produce differing endpoint interpretations. Also clarify whether years with
fewer than ten valid dates are excluded from the reference pool itself or merely
from the count of qualifying years. For season peaks, define a tie-break for
identical smoothed maxima. Keep these outputs unavailable until deterministic.

Scientific sign-off remains pending André's review. A machine-generated
`plan_b` is evidence for that review, not a signature on his behalf. Any sign-off
must use the actual dataset scope, list unexecuted diagnostics and distinguish
native observation provenance from harmonization approval.
