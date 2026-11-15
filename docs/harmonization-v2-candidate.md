# Harmonization candidate v2 (frozen before scoring)

Status: candidate only. Harmonization remains unapproved and the registered Plan B
decision for the frozen v1 models is unchanged. This page was committed together with
the frozen v2 models and before any v2 prediction was computed on a holdout.

## What changed from v1, and why

Each change follows from training-only evidence in
[harmonization diagnostics](harmonization-diagnostics.md).

| Change | Reason |
| --- | --- |
| Terra night turn is paired with, and summed into, the following solar date | Terra night detections fall at 21–23 h local solar time, about 3 hours before the next date's S-NPP night pass and about 21 hours after the same date's |
| Candidates are ratio of sums, EQM with proportional tails, and median ratio | They keep their scale above the training range; endpoint-clamped EQM is excluded a priori because it cannot |
| One method family per suite, selected on out-of-fold weekly MAE of the combined view | The registered criteria are weekly and combined; v1 selected on per-turn MAE |
| Days with an input above the stratum's training maximum are flagged and their interval inflated | Extrapolated estimates deserve wider, explicit uncertainty |

Unchanged: S-NPP FRP target with both turns required, dry/wet seasons, the 30-date and
three-year floor with same-platform/turn season fallback, convex inverse-MAE weights,
nested leave-one-year-out residual intervals, the native benchmark on the identical
cohort, and every registered threshold.

## Frozen result of training-only selection

Model SHA-256: `3c39071a245d071c60e0838d6092a793190f98e2416e2074bbf75911e00aa3ba`
([models](multiyear-evidence/v2-candidate/frozen-models-v2.json),
[receipt](multiyear-evidence/v2-candidate/freeze-receipt-v2.json)).

Out-of-fold weekly results of the combined view inside each training window:

| Experiment | Candidate | Weeks | Weekly PBias | Weekly MAE (MW) | Spearman |
| --- | --- | --- | --- | --- | --- |
| Forward (train 2012–2019) | Ratio of sums | 42 | +2.6% | 981 | 0.937 |
| Forward | **EQM, proportional tails (selected)** | 42 | +2.8% | 968 | 0.948 |
| Forward | Median ratio | 42 | +13.9% | 1,146 | 0.934 |
| Backward (train 2016–2026) | Ratio of sums | 41 | +2.9% | 2,546 | 0.981 |
| Backward | **EQM, proportional tails (selected)** | 41 | +1.1% | 2,415 | 0.984 |
| Backward | Median ratio | 41 | +20.8% | 3,951 | 0.980 |

Weights: forward Terra 0.326 / Aqua 0.674; backward Terra 0.378 / Aqua 0.622.

## Limits on any score of this candidate

The 2020–2026 and 2012–2015 holdouts were examined while v2 was designed: the clamp was
identified from the forward failure, and the forward training window overlaps the
backward holdout. A score of v2 on those holdouts is therefore a post-hoc check, not an
independent validation. `run_harmonization_v2.py score` enforces this: it requires the
hash above, runs once, and always reports `independent_validation: false`, `plan_b` and
`harmonization_approved: false`. Independent evidence needs data not yet examined, such
as another region or biome, or NOAA-20/NOAA-21 as the reference.

## Reproduce

```sh
python3 science/scripts/run_harmonization_v2.py freeze \
  --observations science/outputs/harmonization-review/source-reconstruction/observations.json \
  --output science/outputs/harmonization-review/v2
```

## Post-hoc score (run once, after the freeze commit)

The frozen candidate was scored a single time on both holdouts
([summary](multiyear-evidence/v2-candidate/post-hoc-summary-v2.json)). This is a post-hoc
check on previously examined data, not an independent validation. Harmonization stays
unapproved and the Plan B decision is unchanged.

Combined Terra and Aqua view, registered weekly metrics and thresholds:

| Metric | Forward v2 | Forward v1 (registered) | Forward limit | Backward v2 | Backward v1 (registered) | Backward limit |
| --- | --- | --- | --- | --- | --- | --- |
| Paired days / eligible weeks | 264 / 26 | 286 / 25 | at least 120 / 25 | 361 / 27 | 424 / 34 | at least 80 / 15 |
| Weekly PBias | +10.5% | −36.6% | within ±25% | +12.6% | +16.5% | within ±30% |
| Weekly Spearman | 0.962 | 0.867 | at least 0.75 | 0.925 | 0.918 | at least 0.70 |
| Weekly MAE (MW) | 4,105 | 7,165 | below benchmark | 906 | 884 | not required |
| Benchmark MAE, same cohort (MW) | 4,126 | 4,716 | reference | 1,515 | 1,280 | reference |
| Relative MAE | 0.216 | 0.375 | at most 0.45 | 0.193 | 0.217 | not required |
| Daily interval coverage | 76.1% | 71.0% | 70%–92% | 71.7% | 75.7% | at least 68% |
| Median relative interval width | 1.19 | 1.14 | at most 2.0 | 1.74 | 3.06 | not required |

Every registered check of the combined view is met in both experiments. Read this with
its limits:

- The forward MAE improvement over the benchmark is marginal (4,105 vs 4,126 MW), and the
  benchmark keeps the higher weekly rank agreement (0.987 vs 0.962).
- The v2 cohort differs from v1 because Terra night uses the previous solar date, so the
  v1 and v2 columns are not scored on identical days.
- 29 of the 264 forward days are flagged as extrapolated beyond the training range.
- Single-platform views do not pass on their own: they lack eligible weeks, and the
  Terra-only forward interval is too wide (3.32).
- v2 overestimates in both directions (+10.5% and +12.6%), which suggests a remaining
  positive bias rather than noise.

The candidate is worth carrying to an independent test. It must not be presented as a
validated harmonized series.

## Path to an independent test

The frozen acquisition sampled fixed windows, so most dates of the registered forward
test window were never downloaded. `science/configs/independent_holdout_plan.json` freezes
their complement: 1,868 solar dates from 2020-01-01 to 2026-11-02 in 28 blocks and 790
requests, with the same region, sources and rules.

Nothing runs until the scientific owner's decisions are committed as
`science/configs/independent_holdout.registration.json`, which binds the candidate hash,
the plan fingerprint and the thresholds fingerprint to four recorded decisions. The
`Independent holdout acquisition` workflow, `independent_holdout.py` and
`run_harmonization_v2.py score-independent` all refuse to run without it. The score uses
only holdout target dates; examined cells supply only the previous-date Terra night
predictor at block edges. The script reports whether the registered combined checks are
met and never approves harmonization itself. The owner-facing request is in
[`docs/handoff/andre-independent-holdout.md`](handoff/andre-independent-holdout.md).
