# ChronoFlare — multi-year pipeline delivery

Reviewed November 15, 2026 (São Paulo). This delivery implements the four
engineering stages requested after registration of scientific thresholds. It
leaves Anastasia's visual upgrade independent of scientific processing.

## Review and merge sequence

| PR | Stage | Behavior |
| --- | --- | --- |
| 42 | Expanded fixed design | Complete backward holdout years plus fixed forward windows: 2,450 candidate dates and 1,012 SP requests |
| 43 | Resumable downloads | Preserve 416 existing files, migrate the plan with a receipt and acquire only missing requests |
| 40 | Actual sample sufficiency | Reconstruct complete source blocks, quality/deduplication, both experiment support gates |
| 41 | Training and validation | Nested training-only LOYO, freeze models, evaluate independent holdouts or report explicit blockage |

Merge order is 42 → 43 → 40 → 41. Initial plan PR 37 is already on main;
PR 38 was merged into its already-merged feature branch, so PR 43 preserves and
integrates that acquisition work. PR 39 was reviewed, its loader timestamp crash
fixed, and merged into main before the remaining scientific PRs. All four
branches include that reviewed UI commit without conflicting changes. Retarget
each next PR to main after its predecessor merges; do not assume GitHub moves a
PR whose base is an already-merged feature branch.

## Decisions and differences from earlier work

The bounded plan expands beyond the fifteen-day pilot. The original eight-year
input provided 162 forward test days/17 eligible weeks and 106 backward days/eight
weeks, below the registered 25/15-week floors. No real model was fitted or scored.
Version 1.1 therefore completes every backward-test solar date from January 20,
2012 through December 31, 2015, and adds fixed seasonal windows in consecutive
forward years 2022–2024. This expansion uses support counts, not model errors. It does not request Brazil-wide
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

The initial 416-request acquisition completed successfully and remains preserved.
A MODIS request exposed finite negative FRP; audit retention now preserves those
rows and the unchanged strict positive-FRP filter rejects them before deduplication.
The default raw importer retains its original behavior. The expanded acquisition
reuses the first 416 files and requests only 596 new windows. Its final source
and experiment reports are tracked under `docs/multiyear-evidence`. No extra key
or manual entire-base download has been requested from André.

## Verification and operation

All 180 scientific tests pass, including corruption-before-network rejection,
resume, partial/empty blocks, sample-versus-approval separation, holdout target
perturbation, nested exclusion, quantile mapping, convex arithmetic and full
controlled freeze-before-scoring. CI also verifies the application tests, data,
TypeScript build and English-language policy. Scientific work does not alter frontend behavior; the separately reviewed loader
fix and merged UI are documented in `docs/qa/2026-11-15-chrono-loader-review.md`.

Use `docs/multiyear-pipeline.md` for CLI and workflow operation. Raw evidence and
model artifacts have 90-day retention: preserve controlled copies before expiry.
The application keeps its existing scientific notices and harmonization gate.
