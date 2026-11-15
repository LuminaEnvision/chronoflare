# Harmonization v2 — approved scope and experiment history

## Current status: Plan A approved

The scientific owner approved the **frozen v2 forward model for the Pantanal**, with
publication restricted to dates on which **both Terra and Aqua have complete aligned
day/night inputs**. The authoritative [decision record](../science/configs/harmonization_decision.json)
was registered on 2026-11-15 at 17:11:26 UTC; the [owner's written reply](handoff/andre-plan-a-decision.md)
is retained separately. The historical Plan B result applies to the rejected v1 and
remains unchanged in its original evidence.

Approved claim: **Harmonized series for the Pantanal, validated in an independent
2020–2026 test, with limited coverage in 2025–2026 and no independent backward test.**

Current evidence and publication:

- The registered independent forward evaluation passed its combined-view checks:
  506 paired days / 40 eligible weeks, weekly PBias about −1.0%, and weekly MAE
  1,675.5 MW versus 2,589.0 MW for the matched uncalibrated benchmark.
- The app publishes 635 estimates under the stricter both-platforms-complete scope.
  Only six estimates are available in 2025 and five in 2026.
- Of those published estimates, 232 fall in the training period. Agreement there
  is not validation evidence. There is no independent backward test.
- Passing harmonization does not approve anomaly/season classifications or a
  forecasting or emergency-alert service.

Read the [independent result](#independent-holdout-result),
[owner decision and published series](#owner-decision-and-published-series), and
[current application behavior](#current-application-behavior) below.

This is a living status document. Its initial candidate revision was committed
before the first v2 holdout score; the early stages below are now explicitly
historical. Frozen model files, receipts, one-time scores and approval records are
not rewritten when this narrative is updated. The filename and frozen engine
identifier retain “candidate” for provenance; they do not define the current
scientific approval status.

## What changed from v1, and why

The revision followed the [diagnosis of the rejected v1](harmonization-diagnostics.md),
which included its already examined holdout failure. Candidate comparisons,
parameter fitting and method selection were restricted to training data. That
history is why the first v2 scores below are post-hoc and the later registered,
previously unexamined dates were needed as independent evidence.

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

## Frozen result of training-only selection (historical fit)

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

The year ranges in the table are registered window bounds, not claims of complete
acquisition. The available forward training dates were in 2012–2015 and 2017–2019;
the available backward training dates were in 2017–2024. In particular, 2016 was
not acquired. These are the historical fitted models, not new fits using the later
independent acquisition.

## Limits on the original, already examined holdouts

The original sampled dates within the 2020–2026 forward window and the 2012–2015
backward holdout had been examined while v2 was designed: the clamp was identified
from the forward failure, and the forward training window overlaps the backward
holdout. A v2 score on those same examined dates is therefore post-hoc, not independent.
This does not mean every date in 2020–2026 had been examined; the later independent
test used the registered complement of previously unexamined dates in that window.
`run_harmonization_v2.py score` enforces this: it requires the
hash above, runs once, and always reports `independent_validation: false`, `plan_b` and
`harmonization_approved: false`. Those fields describe the post-hoc scorer's output,
not a current override of the later owner approval. Independent evidence required
previously unexamined data. The registered complementary dates below supplied that
forward evidence; another region or NOAA-20/NOAA-21 remains a possible future extension,
not an outstanding prerequisite for the recorded Pantanal approval.

## Historical training command

This command documents the training step. The current app uses committed frozen
artifacts; it does not retrain or repeat the one-time scores when building.

```sh
python3 science/scripts/run_harmonization_v2.py freeze \
  --observations science/outputs/harmonization-review/source-reconstruction/observations.json \
  --output science/outputs/harmonization-review/v2
```

## Post-hoc score (historical, run once after the freeze commit)

The frozen candidate was scored a single time on both holdouts
([summary](multiyear-evidence/v2-candidate/post-hoc-summary-v2.json)). This is a post-hoc
check on previously examined data, not an independent validation. At that stage,
harmonization was still unapproved and the prior Plan B remained in force. The later
independent test and recorded Plan A decision supersede that pending status for the
approved v2 publication scope; the post-hoc evidence itself is unchanged.

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

The conclusion at this historical stage was to carry the candidate to an independent
test and withhold any claim of validated harmonization based on the post-hoc result
alone. That test and the subsequent scoped approval are documented below.

## Independent test protocol (completed)

The frozen acquisition sampled fixed windows, so most dates of the registered forward
test window were never downloaded. `science/configs/independent_holdout_plan.json` freezes
their complement: 1,868 solar dates from 2020-01-01 to 2026-11-02 in 28 blocks and 790
requests, with the same region, sources and rules.

The acquisition and one-time score were gated on the scientific owner's decisions,
committed as `science/configs/independent_holdout.registration.json`. That record binds
the candidate hash, plan fingerprint and thresholds fingerprint to four decisions. The
`Independent holdout acquisition` workflow, `independent_holdout.py` and
`run_harmonization_v2.py score-independent` all refuse to run without it. The score uses
only holdout target dates; examined cells supply only the previous-date Terra night
predictor at block edges. The script reports whether the registered combined checks are
met and never approves harmonization itself. The owner-facing request is in
[`docs/handoff/andre-independent-holdout.md`](handoff/andre-independent-holdout.md).

## Independent holdout result

The scientific owner's decisions were registered in commit `4d265ad`, before any holdout
download. Actions run 43736011324 then acquired all 790 requests and reconstructed all
28 blocks, with no missing block. The frozen candidate was scored once
([summary](multiyear-evidence/v2-candidate/independent-summary-v2.json)).

Combined Terra and Aqua view, forward model trained on 2012–2019, on dates never examined
before the registration:

| Metric | v2 on the independent holdout | Benchmark, same cohort | Registered limit |
| --- | --- | --- | --- |
| Paired days / eligible weeks | 506 / 40 | same | at least 120 / 25 |
| Weekly PBias | −1.0% | −29.4% | within ±25% |
| Weekly Spearman | 0.965 | 0.971 | at least 0.75 |
| Weekly MAE (MW) | 1,676 | 2,589 | below benchmark |
| Relative MAE | 0.200 | 0.308 | at most 0.45 |
| Daily interval coverage | 72.7% | n/a | 70%–92% |
| Median relative interval width | 1.74 | n/a | at most 2.0 |

Every registered forward check of the combined view was met. The owner considered
these limitations when recording the subsequent approval:

- Paired days by year: 143 (2020), 83 (2021), 66 (2022), 73 (2023), 100 (2024), 28 (2025)
  and 13 (2026). The most recent years contribute little, so this result says less about
  2025–2026 than about 2020–2024.
- The benchmark keeps a slightly higher weekly rank agreement (0.971 vs 0.965).
- Interval coverage is near the lower limit (72.7% against a 70% floor).
- 35 of the 506 days are flagged as extrapolated beyond the training range.
- Regimes: 229 days with both platforms, 144 Terra only, 133 Aqua only.
- There is no independent backward test; the registered backward rule accepts the post-hoc
  v2 result as descriptive evidence.

The scoring script reports whether the criteria were met; it does not approve
harmonization. The scientific owner subsequently applied the registered rule and
recorded the scoped Plan A decision below. A scorer's `harmonization_approved: false`
field is not a replacement for that separate human decision.

## Owner decision and published series

After the independent result, the scientific owner chose Plan A for the v2 forward model.
The decision is recorded in `science/configs/harmonization_decision.json`, with the
verbatim reply in `docs/handoff/andre-plan-a-decision.md`. It binds the frozen model hash,
the independent summary and the registration, and it sets the scope and the claim:

- Claim: harmonized series for the Pantanal, validated in an independent 2020–2026 test,
  with limited coverage in 2025–2026 and no independent backward test.
- Scope: only solar dates on which both Terra and Aqua are complete.

The Plan B result of the frozen v1 models stays in the record unchanged.

`science/scripts/export_harmonized_series.py` applies the frozen model without refitting
and refuses to run unless that decision and every evidence hash match. It writes:

- `app/public/data/observations/v1/`: the browser contract (`manifest.json` plus one file
  per year). Every acquired solar date has a row with native Terra, Aqua and S-NPP turn
  aggregates on their own solar dates; `harmonized` is non-null only on complete dates.
  4,318 dates in 14 years (2016 was never acquired), 635 with an estimate.
- `docs/multiyear-evidence/harmonized-series/pantanal-harmonized-daily-v2.json`: the same
  635 estimates with the per-platform calibrated values, the native benchmark, the S-NPP
  reference where it exists, each date's relation to the evidence (`sample_role`), and
  weekly means for ISO weeks with at least five valid days.

Reading the series:

- Estimates by year: 64, 40, 13, 40 (2012–2015); 24, 10, 41 (2017–2019); 142, 71, 29, 44,
  106 (2020–2024); 6 (2025); 5 (2026). Requiring both platforms leaves very few recent
  dates.
- 232 estimates fall in the training window, where agreement with S-NPP is not evidence;
  161 are on previously examined dates and 242 on independent holdout dates.
- 55 estimates are flagged as extrapolated.
- A date without an estimate was not acquired or lacks a complete turn; it is not zero.

```sh
python3 science/scripts/export_harmonized_series.py \
  --observations science/outputs/harmonization-review/source-reconstruction/observations.json \
  --holdout-observations science/outputs/independent-holdout/observations.json \
  --output docs/multiyear-evidence/harmonized-series/pantanal-harmonized-daily-v2.json
```

## Current application behavior

The [published application](https://chronoflare.vercel.app/) consumes the exact hashed
year exports above. Users can select the approved harmonized series or separate native
Terra, Aqua and S-NPP records; inspect estimates, empirical intervals and extrapolation
flags; compare years while preserving gaps; and review the scientific evidence in
[Methodology](https://chronoflare.vercel.app/?view=methodology). It does not display the
historical v1 rejection as the current approval state of v2.

The paired chart uses a display-only transformation of the published series, not a new
fit or score. Of the 635 published dates, 620 have complete S-NPP references for plotting
and 15 do not. The 242 publication dates in the independent holdout include 229 such
pairs. These counts differ from the full 506-day registered evaluation because its
availability regimes and the owner's stricter publication scope differ. Neither
filtering points nor inspecting a training date changes the registered test metrics.

See [real-data integration and limitations](real-observation-experience.md) and
[persistent inspection and shared exploration](exploration-inspection-and-sharing.md).
The scope remains the approved Pantanal forward model; additional regions, continuous
historical coverage and anomaly/season classification require further work and review.
