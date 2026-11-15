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
branches include that reviewed UI commit without conflicting changes. All pending PRs now target main directly to avoid repeating that base-branch
problem. Their diffs narrow as predecessors merge; keep the declared merge order.

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

## Verification and operation

All 183 scientific tests pass, including corruption-before-network rejection,
resume, partial/empty blocks, sample-versus-approval separation, holdout target
perturbation, nested exclusion, quantile mapping, convex arithmetic and full
controlled freeze-before-scoring. CI also verifies the application tests, data,
TypeScript build and English-language policy. Scientific work does not alter frontend behavior; the separately reviewed loader
fix and merged UI are documented in `docs/qa/2026-11-15-chrono-loader-review.md`.

Use `docs/multiyear-pipeline.md` for CLI and workflow operation. Raw evidence and
model artifacts have 90-day retention: preserve controlled copies before expiry.
The application keeps its existing scientific notices and harmonization gate.

## Completed real-data outcome

Acquisition and reconstruction finished successfully: 1,012 verified request
files, 32 complete blocks and 2,450 candidate solar dates. The regional audit
retained 564,072 raw rows, passed 514,169 through quality and excluded one
technical duplicate, leaving 514,168 selected detections. One negative and 228
zero raw FRP values were preserved for audit and rejected by strict quality.
These are detections, not confirmed individual fires or observed zero-fire days.

Both independent models were fitted, frozen and scored in run
https://github.com/j-c-fstk-dev/chronoflare/actions/runs/43719416857 .
All registered source/sample prerequisites passed. The outcome is **Plan B due
to failed forward performance**, rather than insufficient data or an unrun test.

| Combined-view metric | Forward | Backward |
| --- | --- | --- |
| Paired days / eligible ISO weeks | 286 / 25 | 424 / 34 |
| Weekly Spearman | 0.8669 | 0.9184 |
| Weekly PBias | −36.58% | +16.45% |
| Weekly MAE on paired daily means | 7,164.82 MW | 883.60 MW |
| Relative MAE | 0.3750 | 0.2172 |
| Daily interval coverage | 70.98% | 75.71% |
| Median relative interval width | 1.1353 | 3.0642 |

Forward PBias exceeds the registered ±25% bound. Its MAE also exceeds the
same-cohort uncalibrated benchmark's 4,716.02 MW, so strict improvement fails.
The other combined forward checks pass; all registered combined backward
checks pass. Backward relative width is diagnostic: the JSON does not impose
the forward width ceiling on the backward experiment. Individual-platform views
are retained in the full report, including their support shortfalls and failures.

The forward fit selected EQM in five strata and median ratio in three, with
training-only weights Terra 0.3851 / Aqua 0.6149. The backward fit selected six
EQM / two ratio strata, with weights 0.3923 / 0.6077. Full-precision parameters,
selection folds, intervals and training dates are committed in
`docs/multiyear-evidence/frozen-models.json`; its SHA-256 is
145ca3df4e9a5b622b24a977ebf56b83639f59176c7d0bc7c2adaf29f2761ecd.
The source-data fingerprint and pre-scoring receipt are preserved alongside it.
A separate export verified those hashes without refitting or rescoring.

The sparse-fold issue was resolved by recomputing the already-permitted
same-platform/turn seasonal fallback inside each training-only LOYO fold, with
both original training floors intact. Diagnostic single-platform views also
have separate residual pools, preventing counterfactual days from augmenting
the combined model's actual missing-platform regime. These corrections preceded
the reported final holdout evaluation and introduce no new acceptance threshold.

The scientific decision registry now records the failed forward checks. The
application remains unchanged: this experiment does not approve a harmonized
series, an uncalibrated splice, anomalies or pre-2012 publication. Future research
must preserve this result and use training-only development plus independent
validation; do not tune coefficients, dates or thresholds against these scores.
The forward evaluation is a bounded seasonal subset of its registered window,
not a full 2020–2026 annual record. Observation coverage remains unknown.

## Remaining work after this delivery

| Stage | Final state | Remaining |
| --- | --- | --- |
| Acquisition | Complete fixed v1.1 input; 416 reused and 596 new requests | Preserve raw artifacts before 90-day expiry; future versioned acquisition only if needed |
| Sample audit | Both registered experiments meet date/year/week minima | Scientific review of coverage and the fixed official spatial reference |
| Calibration | Both independent fits frozen with parameters and provenance | Training-only diagnostics for a new research iteration |
| Validation | Executed; Plan B because forward bias and naive improvement fail | Scientific interpretation; independent validation for any revised method |
| Publication | Harmonization remains disabled; native app data preserved | Reviewed native-data publication and product integration |
| UI | PR 39 reviewed, timestamp crash fixed and merged first | Lumina fork/default-branch sync and production/device QA |

The final suite has 183 scientific tests, plus 102 application tests in CI.
No extra API key or manual entire-base download was required.
