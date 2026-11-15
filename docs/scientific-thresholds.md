# Delivery 4: registered scientific acceptance criteria

The supplied structured JSON is the canonical acceptance policy. The original
attachment is fingerprinted in `science/configs/thresholds.receipt.json`; the
operational `thresholds.json` preserves its numerical values and translates only
the owner's professional role into English. The source declares registration at
2026-11-14 22:57 UTC−03 (2026-11-15 01:57 UTC). The receipt separately records
workspace ingestion: it does not independently attest the supplier's timestamp.
This registration preceded fitting. Completed results and the current scoped Plan A approval are summarized in [validation status](validation-report.md); the numerical policy and its receipt remain unchanged.

## Explicit resolutions of differences between deliveries

| Topic | Operational interpretation of delivery-4 JSON |
| --- | --- |
| Weekly scale | Mean of valid paired daily values, Monday–Sunday ISO weeks, minimum five matched days. Supersedes delivery-3 seven-day-equivalent primary scoring. |
| Forward Spearman | Combined/Aqua at least 0.75; Terra at least 0.70; average ranks for ties. |
| Forward absolute PBias | Combined/Aqua at most 0.25; Terra at most 0.30, following JSON despite the prose's uniform 0.25. |
| Combined relative MAE | At most 0.45 AND strictly smaller MAE than the naive splice on the exact same weekly cohort. The prose's alternative 20% improvement is not an additional JSON threshold. |
| Forward daily intervals | PICP from 0.70 through 0.92, median relative width at most 2.0. |
| Backward transfer | Spearman at least 0.70, absolute PBias at most 0.30, daily PICP at least 0.68; the latter is required by JSON. |
| Per-stratum support | Train: 30 positive paired dates in three years. Test: 15 dates in two years. Season fallback retains platform/turn and both year floors. |
| Global support | Forward: 25 eligible weeks and 120 paired days. Backward: 15 weeks and 80 days. |

Weekly PBias is sum(estimated weekly mean − observed weekly mean) divided by
sum(observed weekly mean). Weekly MAE divides summed absolute errors by the
number of eligible weeks; relative MAE divides that MAE by the mean observed
weekly value. These are equally weighted weeks, not equally weighted days.
Daily error metrics are separate diagnostics. Constant series have undefined
Spearman; zero denominators remain undefined, without epsilon substitution.

Daily PICP divides inclusive interval hits by paired daily observations. Missing
bounds fail interval evaluation without silently shrinking that denominator.
Relative width is (upper − lower) / daily estimate; its median is tested.
Weekly PICP remains null: the daily interval recipe does not define calibrated
weekly intervals. Paired-day fractions are temporal support, not cloud coverage.

## Implementation and evidence

`science/scripts/scientific_thresholds.py` validates the frozen registration,
computes metrics from explicitly supplied predictions, verifies distinct-date/year
support and selects Plan B whenever prerequisites are absent or checks fail.
The original v1 gate additionally requires both experiments, exact threshold binding,
complete same-cohort evidence and upstream verified frozen-model provenance.
For the later v2, the owner separately registered the independent-test protocol and
accepted backward post-hoc results as descriptive evidence, then issued the
[scoped approval](../science/configs/harmonization_decision.json). The original
helper is not the current human-approval registry. This helper
is not a model fitter or a production publication endpoint. Synthetic passing
fixtures test the decision branch; they are never real scientific evidence.

The original delivery-4 readiness snapshot under `docs/thresholds-evidence/`
describes the earlier fifteen-day 2019/2020 pilot and remains a historical record.
The historical complete v1 multi-year experiment is under `docs/multiyear-evidence/`:
all registered sample prerequisites passed, both models were fitted and frozen,
and both holdouts were evaluated. Combined forward PBias (−36.58%) and failure
to improve the matched naive MAE selected Plan B for v1. This is an empirical model
rejection, not an unrun test. The later frozen v2 passed its registered independent
forward evaluation and received Plan A approval; it does not overwrite the v1
report or the original thresholds. Synthetic fixtures retain their own status.

Reproduce the historical pilot readiness without a key:

```sh
python science/scripts/scientific_thresholds.py \
  --observations docs/indicator-observations/summary.json \
  --output /tmp/chronoflare-scientific-readiness
```

The output must be new. The `indicator` workflow mode reconstructs observed
inputs from frozen training-period artifacts without NASA calls, then publishes
sanitized observations and readiness to a separate review branch. Raw source
files stay in restricted Actions artifacts; reviewed source hashes remain pinned.

The acquisition, independent v2 evaluation and reviewed application publication
have since completed. Further regions, seasonal/anomaly products and pre-2012
publication are not covered by that approval. See the [current evidence and limits](validation-report.md).
No new key is required to serve the committed static application data.

Verified offline reconstruction: https://github.com/j-c-fstk-dev/chronoflare/actions/runs/43668370570
