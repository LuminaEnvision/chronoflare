# Harmonization diagnostics

Status: diagnostic only. The frozen models (SHA-256 `145ca3df…761ecd`), the registered
thresholds and the Plan B decision are unchanged. Held-out rows are used below only to
describe the registered failure. Every comparison between calibration ideas uses
leave-one-year-out folds inside the training window. The forward test is spent: any
changed model needs a new, pre-registered evaluation before it can be called independent.

## Reproduce

```sh
gh run download 43719416857 --name scientific-experiment-evidence --dir science/outputs/harmonization-review
python3 science/scripts/diagnose_harmonization.py \
  --evidence science/outputs/harmonization-review \
  --output science/outputs/harmonization-review/diagnostics.json
```

## What is established

1. **No arithmetic or routing bug.** Refitting from the reconstructed pairs reproduces the
   frozen models bit for bit, and the stored predictions are reproduced exactly, in both
   experiments. Day/night sums, routing, weights and the same-cohort benchmark behave as
   documented.

2. **The EQM endpoint clamp loses the fire-season tail.** The forward dry-season models
   cannot emit more than 25,704 MW per day (Terra: 23,021 day + 2,682 night; Aqua: 22,433 +
   3,173). S-NPP observed more than that on 49 of the 286 forward test days. With exact
   estimates on every day below the ceiling, the combined weekly PBias would be −27.9%;
   the registered value is −36.6%. This is a lower bound on the tail loss, not a proof that
   the ±25% limit is unreachable: overestimating other days can offset it (emitting the
   ceiling on every dry day gives +19.8%; a uniform 10% overestimate below the ceiling
   gives −24.5%). Passing that way would mean compensating errors, not a correct series.
   Days with at least one input above its top knot carry 78% of the observed weekly FRP and
   contribute −29.0 of the −36.6 points; the uncalibrated benchmark loses only −13.1
   points on the same days. This is why calibration lost to the benchmark on MAE.

3. **The training years could not reveal this.** The forward training window (2012–2019)
   peaks near 46,000 MW per S-NPP turn; the test window contains the 2020 and 2024 Pantanal
   fire seasons, with days above 100,000 MW. Inside training folds only 1.3–2.7% of
   held-out inputs exceed the fold's top knot, so MAE-based selection preferred EQM.

4. **Both candidates are biased on totals by construction.** PBias is a ratio of sums, and
   FRP is heavy-tailed: the top 1% of training pairs hold 11–18% of the reference FRP per
   stratum. EQM with 99 knots flattens that tail, and a median of ratios differs from the
   ratio of sums (Aqua night/dry: 1.77 vs 1.23; Terra night/wet: 0.36 vs 0.63). Training
   out-of-fold weekly PBias, combined view, forward window: native −26.0%, EQM with clamp
   −7.1%, median ratio +15.3%.

5. **Terra night is paired with a distant S-NPP night pass.** The solar dates themselves
   are correct: recomputing them from the UTC timestamps matches every selected 2019
   dry-season record. The issue is which passes share a date. Terra night detections fall
   at 21–23 h local solar time and S-NPP night detections at 0–2 h, so the Terra pass of
   date *d* is about 3 hours before the S-NPP night pass of date *d+1* and about 21 hours
   after the one of date *d* that it is paired with. In the forward training window Terra
   night agrees with the next-date S-NPP night at Spearman 0.79 versus 0.57 for the same
   date (0.86 vs 0.77 in the backward training window). Aqua night (0–2 h) and both day
   turns peak on the same date, as expected. This is consistent with the weak Terra night
   strata, including the 0.358 factor; it is a pass-alignment design question, not a
   solar-date bug.

6. **Cohort selection is a minor effect.** In the forward training window, days where
   S-NPP has both turns but no MODIS platform has both hold 8.9% of S-NPP FRP. Days with
   only one complete platform hold 28.6%; they contribute −3.7 of the −36.6 points in the
   forward test.

## Hypotheses for a new, pre-registered experiment

These are supported by training-only evidence but are not validated.

- **Use a total-preserving calibration that extrapolates.** Out-of-fold results inside the
  forward training window, combined view (53 weeks):

  | Idea | Weekly PBias | Weekly MAE (MW) | Spearman |
  | --- | --- | --- | --- |
  | Native benchmark | −26.0% | 1,250 | 0.964 |
  | Median ratio (current) | +15.3% | 991 | 0.960 |
  | EQM, clamped (current) | −7.1% | 1,115 | 0.949 |
  | Ratio of sums | +4.7% | 837 | 0.954 |
  | EQM, proportional beyond the end knots | +5.1% | 881 | 0.957 |

  The backward training window gives the same ordering (+3.0% and +2.4% for the last two).
- **Assign Terra night detections to the following solar date** before pairing and before
  the daily sum. In training this raises the Terra night/dry rank agreement from 0.55 to
  0.79 and lowers its native MAE from 386 to 256 MW.
- **Select on the registered objective.** Choose methods on out-of-fold weekly PBias and
  MAE after daily combination, not on per-turn MAE.
- **Flag extrapolation.** Mark days whose inputs exceed the training range and widen their
  intervals; `empirical_ratio_interval` already accepts `is_extrapolated`.

## What must not be claimed

The 2020–2026 window has now informed this analysis. It can describe the failure, but a
revised model scored on it is not an independent test. An honest path is to pre-register
the revised recipe, and evaluate it on data not yet examined (another biome or region, or
NOAA-20/NOAA-21 as an independent reference), keeping Plan B until that passes.
