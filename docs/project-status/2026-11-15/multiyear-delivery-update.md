# ChronoFlare — multi-year pipeline delivery

Reviewed November 15, 2026 (São Paulo). This delivery implements the four
engineering stages requested after registration of scientific thresholds. It
leaves Anastasia's visual upgrade independent of scientific processing.

## Review and merge sequence

| PR | Stage | Behavior |
| --- | --- | --- |
| 37 | Fixed acquisition design | Eight years, two 63-day seasonal windows, 1,008 candidate solar dates and 416 SP requests |
| 38 | Resumable downloads | Verify immutable cache, pace bounded requests/retries, preserve partial evidence |
| 40 | Actual sample sufficiency | Reconstruct complete source blocks, quality/deduplication, both experiment support gates |
| 41 | Training and validation | Nested training-only LOYO, freeze models, evaluate independent holdouts or report explicit blockage |

These PRs are stacked in this order. PR 39 belongs to the independent frontend
work. After merging each predecessor, retarget the next PR to main if GitHub has
not done so automatically. Do not merge the feature branches out of order.

## Decisions and differences from earlier work

The bounded plan expands beyond the fifteen-day pilot using fixed wet/dry
windows chosen before calibrated holdout scoring. It does not request Brazil-wide
archives or change temporal splits, scientific thresholds, source platforms,
solar-day definition, strict quality, deterministic deduplication or the pinned
IBGE boundary. Candidate dates are not guaranteed observations or full coverage.

Acquisition failures preserve verified source entries and remain explicit. Only
complete request blocks can generate observed solar cells. Neither a successful
empty CSV nor a missing turn becomes a zero.

The model engine implements median ratios and 99-quantile monotone mapping,
with explicit linear interpolation, duplicate-knot averaging, endpoint clamping
and deterministic ratio preference in exact MAE ties. An outer year-exclusion
loop repeats model selection and weight fitting without that year before
collecting training residuals. This is stricter than using selected-model OOF
errors alone: each fold retains the registered training floor, so a nominally
sufficient three-year sample can still be blocked by nested support.

The naive benchmark holds the frozen convex platform weights and daily cohort
fixed while removing scale calibration. Its exact definition is recorded for
scientific review because the supplier JSON names the benchmark without specifying
its platform-combination arithmetic. No favorable benchmark is chosen after
holdout scoring. Nominal empirical intervals do not guarantee finite-sample
coverage, and unsupported interval regimes retain missing bounds.

Both independent models and their source, threshold and code hashes are frozen
before either final holdout is scored. Only registered metrics drive the offline
Plan A/B decision. Source hashes, training dates, folds, predictions and model
receipts remain auditable; synthetic passing tests are not scientific evidence.

## Remaining work by stage

| Stage | Implemented | Still required for scientific/application completion |
| --- | --- | --- |
| Acquisition | Fixed plan, protected cache, resumable workflow, actual partial inputs | Finish and verify all requests; resolve provider/input failures |
| Sample audit | Both splits, seasons/fallback, distinct date/year and ISO-week checks | Actual complete support meeting all minima |
| Calibration | Training-only candidates, weights, nested residuals and freeze receipts | Successful fitting on sufficient real inputs |
| Evaluation | Weekly/daily metrics, same-cohort baseline, Plan A/B logic | Real independent holdout results when prerequisites permit |
| Publication | No automatic app writes or deployment | Scientific review and explicit versioned publication candidate |
| Product | Existing data/UI contracts preserved | Integrate Anastasia's separate visual upgrade and run device QA |

At the verified partial checkpoint, 211 requests and eight blocks cover
2017–2020 wet/dry windows. Forward support is 94 complete candidate days and ten
eligible weeks; backward test support is absent. These inputs are insufficient.
The cache is retained in Actions artifacts, not committed raw data. No extra key
has been requested. Latest run-specific evidence will be recorded alongside this
report; this checkpoint does not claim real model fitting or approval.

## Verification and operation

All 175 scientific tests pass, including corruption-before-network rejection,
resume, partial/empty blocks, sample-versus-approval separation, holdout target
perturbation, nested exclusion, quantile mapping, convex arithmetic and full
controlled freeze-before-scoring. CI also verifies the application tests, data,
TypeScript build and English-language policy. No frontend source files changed.

Use `docs/multiyear-pipeline.md` for CLI and workflow operation. Raw evidence and
model artifacts have 90-day retention: preserve controlled copies before expiry.
The application keeps its existing scientific notices and harmonization gate.
