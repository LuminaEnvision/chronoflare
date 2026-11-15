# Indicator delivery 3 — engineering review

Received November 14, 2026 (São Paulo). Supplier version `v1.0-handoff-3`, declared
registration `2026-11-14T21:00:00-03:00`. Document SHA-256:
`471eedac00a9415f16149d644f7ebee72da10e2c1217d6c15ed6c2ad092c0d6a`.

The attachment is scientific input, not executable instructions or evidence that
a model has been fitted/validated. Its numerical example is illustrative. The
pasted message accompanying it repeats the earlier engineering feedback; the
attached specification is the new delivery.

## Definitions now explicit

- S-NPP is the fixed VIIRS reference. NOAA-20 is a separate sanity series and
  NOAA-21 is not concatenated into the historical target.
- Observations are grouped by platform, solar date and day/night turn. Positive
  FRP is summed within each group, with valid-detection count as a benchmark.
  A sum of instantaneous FRP is a relative activity statistic, not energy or
  burned area. The eventual calibrated unit is VIIRS-equivalent MW.
- SP requires source type 0, strictly positive FRP, critical fields including
  instrument and day/night, MODIS confidence at least 30, and VIIRS nominal/high.
  MODIS classes are low 0–29, nominal 30–79 and high 80–100.
- Missing auxiliary brightness/pixel-size fields remain null and do not alone
  exclude otherwise valid observations.
- Terra and Aqua observations/estimates stay separate before combination. A
  convex combination estimates a common target; their estimates are never added.
- Forward, backward-proxy and NOAA-20 sanity periods are supplied. Validation
  must report Terra-only, Aqua-only and combined views, with weekly metrics and
  daily/weekly interval coverage. Numerical approval thresholds are explicitly
  deferred to delivery 4; their absence is expected, not a failed delivery 3.

The machine-readable review is `science/configs/indicator_protocol.review.json`.
Null fields deliberately represent unresolved choices or absent fitted results.

## Implemented now: raw SP quality audit

`science/scripts/indicator_quality.py` implements the deterministic quality
criteria independently of the frozen preview and generic raw normalizer:

```sh
python3 science/scripts/indicator_quality.py \
  --input path/to/original.csv \
  --source MODIS_SP \
  --output science/outputs/indicator-quality-audit
```

The audit stores every structurally valid CSV row, including invalid scientific
values, with source hash, one-based data-row index, original fields, quality
boolean, reasons and confidence class. Missing critical values and malformed
numeric/date inputs fail quality without being replaced. Overlapping rejection
reasons are retained. Numeric source types must be integral, so `0.9` is not
silently truncated into vegetation type 0. Source/instrument mismatch and explicit
RT/NRT processing contradictions fail. The verified FIRMS `SNPP` instrument alias
is preserved for S-NPP only.

The CLI accepts supported SP sources only. NRT remains disabled until its static
H3 mask is separately versioned, sourced and registered; missing SP type is never
accepted as an automatic NRT fallback. The existing strict technical normalizer
remains unchanged. A quality audit is not an AOI cut, deduplication, indicator
aggregate, model fit or approval.

### Real-file verification

The audit ran on the two original supplier **Brazil download CSVs**, August 1–15,
2020. These are national-input counts, not Pantanal indicator totals:

| Input | Raw rows retained | Pass new SP quality | Fail quality |
| --- | --- | --- | --- |
| MODIS | 42,902 | 40,492 | 2,410 |
| VIIRS S-NPP | 162,017 | 148,107 | 13,910 |

VIIRS includes 83 non-positive-FRP rejections. Rejection counts overlap with other
reasons, so they must not be added to infer unique rejected rows. The source
hashes and machine-readable report are in
`docs/indicator-evidence/quality-audit-summary.json`.

The current experimental calendar/filter is an immutable earlier snapshot. Its
candidate filter does not check all new mandatory fields/positive FRP or apply
exact deduplication. It is **not relabeled as delivery-3 compliant**. Its map,
source inspector and hashes remain coherent; a subsequent dataset/rule version
must explicitly regenerate the final indicator inputs.

## Clarifications still needed before complete aggregation/calibration

1. **Conflicting exact-key duplicates.** The text says to keep the first record
   and simultaneously calls it the largest FRP. Those differ when values conflict.
   Confirm the precedence after SP-over-NRT, quality-versus-dedup order, and the
   tie convention for five-decimal coordinate rounding. Identical raw duplicates
   and conflicting same-key values should remain distinguishable in the audit.
2. **A missing day/night turn in an estimate.** Summing observed positives is
   explicitly permitted for an observed daily statistic, but that does not make
   it a complete calibrated daily estimate. Confirm whether to publish a flagged
   available-turn estimate or null unless both required calibrated turns exist.
   A missing turn cannot silently become zero. Target and predictor comparisons
   need compatible turn support.
3. **Weekly evaluation.** Register the seven-day anchor, minimum paired valid
   days and partial-week handling. Sum only matched days; missing days must not
   become zeros or create incomparable weekly supports.
4. **Training/uncertainty edge cases.** Delivery 4 should register the interval
   construction, zero-MAE weight policy and minimum stratum sample size. Ratio
   versus EQM selection must happen within training (for example inner temporal
   validation), keeping the final forward test untouched. Typical or illustrative
   weights such as 0.65 are not fitted coefficients.

These questions do not block the new quality audit. They do block interpreting
that audit as a complete approved indicator/calibration pipeline.

## What remains unchanged

`science/configs/decisions.json`, harmonization gates, the original map and both
calendar datasets are unchanged. No coefficient, weight, uncertainty interval or
validation pass is invented. The existing real sample spans fifteen dry-season
days in 2020; it does not cover the requested 2012–2019 training or all test years.
No new API request or credential is needed for this quality/review step.
