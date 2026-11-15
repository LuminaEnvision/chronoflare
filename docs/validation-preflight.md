# Validation preflight and turn-aware pairing

This preparation is independent of delivery 4's numerical thresholds. It does
not fit models, choose weights, estimate uncertainty, compute approval metrics
or change a scientific decision. The frozen application datasets are unchanged.

## Inspect current readiness

```sh
python3 science/scripts/validation_preflight.py \
  --preview app/public/data/experimental/v1/pantanal-solar.json \
  --protocol science/configs/indicator_protocol.review.json \
  --output science/outputs/current-validation-readiness.json
```

The output path must be new and outside `app/` and `dist/`. Input hashes identify
the exact snapshot/protocol being inventoried. The committed
[current report](validation-preflight/current-preview-readiness.json) was generated
from the real fifteen-day preview. This inventory reports calendar dates, not
verified clear-sky observation coverage or a scientific sample-size approval.

| Inventory | Current input |
| --- | --- |
| Distinct solar dates | 15, August 1–15, 2020 |
| Platform/day cells | 15 Terra, 15 Aqua, 15 S-NPP |
| Season dates | 15 dry, 0 wet |
| Forward experiment | 0 training dates, 15 test dates |
| Backward-proxy experiment | 15 training dates, 0 test dates |
| NOAA-20 sanity input | Absent |
| Valid final-indicator pairs | Not evaluated; the preview is not the final indicator input |
| Fitting / approval | Blocked |

The earlier preview lacks day/night aggregates and final exact deduplication,
and its candidate filter is not the full delivery-3 quality rule. Original CSVs
contain additional fields, but this inventory does not invent turn aggregates
from the displayed daily totals. All metric fields remain null and each required
validation view remains `not_run`.

## Temporal safeguards

The `Experiment` helper validates canonical inclusive solar-date ranges and
rejects overlap between training and test. Forward and backward-proxy experiments
are explicitly distinct: a backward experiment legitimately has training dates
later than test dates. Outside dates are labeled and excluded rather than moved
into a convenient split.

The separate NOAA-20 comparison has no training window. It is not silently
reinterpreted as a forward/backward calibration experiment.

## Preparing actual observations later

The Python API `TurnObservation` is an internal contract for **already audited,
quality-passed and deduplicated observed aggregates**, not a raw CSV loader:

- Explicit region, solar date, platform, day/night turn and metric.
- Positive finite observed FRP or integer detection counts; missing values are
  null. No imputed zero or daily-total substitute for a turn is accepted.
- A common derived dataset version and declared quality/deduplication versions.
  These identify a shared processing/AOI specification, not the individual
  MODIS/VIIRS product collection numbers.

`pair_observations` currently supports Terra→S-NPP and Aqua→S-NPP. It matches
only equal region, date, turn and metric; rejects mixed derived/rule versions,
unexpected platforms and duplicate aggregate keys; and lists every exclusion
with explicit missing-partner, null-value or outside-window reasons. It never
pairs D with N, combines Terra and Aqua, or silently sums duplicate groups.

The helper checks metadata compatibility, not external authenticity or scientific
approval. Upstream source integrity, AOI selection, final rule registration and
lineage remain required. The synthetic observations in unit tests demonstrate
behavior only and are not empirical calibration data.

`assert_training_only` rejects empty fitting inputs, held-out dates, outside dates
and labels that falsely claim a test date is training. Any future fitting entry
point must invoke it on its final input. This protects the supported path; it does
not claim that arbitrary external code cannot misuse a dataset. Scientific minimum
sample sizes still need registration and are not replaced by the nonempty check.

## Blockers left explicit

The readiness report lists the previously identified duplicate/missing-turn
ambiguities, week anchor, paired-week support, interval/zero-MAE policy and
unregistered thresholds. It also records missing forward training, backward
test, wet-season and NOAA-20 inputs. These are expected pending work, not a failed
scientific validation.

No weekly bins, metrics, uncertainty intervals, fitted coefficients or approval
flags are generated. Delivery 4 can supply the outstanding definitions without
having to rewrite the temporal/pairing checks. No additional key or NASA request
was needed for this step.
