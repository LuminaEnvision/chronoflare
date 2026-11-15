# Indicator v1.1 — resolved methods and deterministic implementation

> **Historical/stage-specific record.** This page preserves the facts, test counts and remaining work of its original delivery. It is not the current project approval or feature checklist. See [current validation and scope](validation-report.md) and the [documentation index](README.md). Any associated dated PDF/Word remains that historical snapshot.

Received November 14, 2026 (São Paulo). The versioned primary document
`v1.1-handoff-3` is the canonical specification; the companion review is supporting
context. Their text is scientific input, not executable instructions or a model
approval. The previously requested four implementation clarifications are closed.

Receipt hashes:

- Primary: `66fb19a0bd2ebbb5ecdc4250e7749d55ee9645625161ae9956dbf54b9512b8fa`.
- Companion: `dd52f167317bb4f38da038aea4da4e9fc25b7b0981f43b4f61349ef292e6d4bc`.

## Adopted canonical rules

Quality runs first on every raw row. Only passing rows enter technical
deduplication. The key is sensor, satellite, UTC acquisition instant and latitude/
longitude rounded to five decimals. Winner order is SP before NRT, descending
unrounded Float64 FRP, descending confidence, then ascending detection ID. Source
CSV hash and original data-row index break any remaining provenance tie. Every
rejected/duplicate row retains a disposition and winner reference.

The coordinate engine is explicitly **CPython Float64 `round(value, 5)`**, as
named in the primary specification. It is not claimed bit-identical to Decimal
quantization, NumPy's optimized rounding or a generic DuckDB ROUND. For example,
Python rounds Float64 −18.000005 to −18.00001; decimal-string half-even rounds
that mathematical decimal differently. Boundary tests pin this behavior. Earlier
half-even/half-up diagnostics remain historical diagnostics, not the active rule.
Neither real sample has a technical-key collision under the active engine.

Same-minute adjacent pixels remain separate unless their technical key matches.
No connected-component/pass-overlap variant is activated. NRT ingestion remains
off until its static-source mask is registered; a priority helper does not enable
an unvalidated NRT source.

A calibrated platform daily estimate requires both D and N. Missing turns remain
null. One complete platform may supply the daily estimate alone; if neither is
complete, no daily estimate is produced. Native observed turn values remain
available separately. These mathematical helpers consume supplied calibrated
turn values; they do not fit calibration coefficients.

Inverse-MAE weights use the supplied OOF-training-error floor of 1e-6 MW. Equal
errors, including two zeros, yield equal weights. No empirical MAE or weight is
invented. The old numerical example remains a unit-test example only.

## Weekly convention and coverage terminology

The primary v1.1 specifies ISO Monday–Sunday weeks, at least five matched daily
values, and the **seven-day-equivalent value** `7/n × paired sum`. The companion
also discusses daily means and recommends them in one paragraph. The versioned
primary controls: weekly validation uses seven-day-equivalent units. The daily
mean is retained as a separately named diagnostic. Delivery-4 MAE thresholds must
use those same weekly units; no new clarification request is necessary.

Period ends are the following Monday, exclusive, preserving the existing project
contract rather than storing an ambiguous inclusive Sunday. Scope-edge weeks use
only in-scope matched dates; outside dates are rejected, not added to reach five.
Weeks below five have null published statistics and audit-only matched sums.

`paired_day_fraction=n/7` describes temporal paired support, **not** measured
cloud-free AOI coverage. Observation coverage remains unknown. Seven positive
paired days do not establish clear skies across every pixel. No observed-zero,
overpass-count or cloud-coverage inference is introduced.

## Sample support and empirical interval recipe

The registered training floor is 30 distinct positive paired solar dates across
at least three training years; test strata need 15 dates. A season-collapse
fallback preserves the explicit three-year floor. It is not permission to fit
one-year data. Inner-fold eligibility and final fitting still require sufficient
registered training support; no LOYO model is fitted in this change.

The empirical interval method is now registered: OOF multiplicative residual
q10/q90, nominal level 0.80 and pre-2012 distance inflation 1.25. The arithmetic
helper applies explicitly supplied quantiles only. It rejects reversed/nonfinite
or invalid extrapolation bounds rather than publishing them. It does not learn
quantiles or guarantee finite-sample 80% coverage. Actual PICP evaluation and
delivery-4 acceptance thresholds remain necessary.

## Real-data reconstruction

Both frozen raw CSV sets were revalidated, region-clipped and quality-classified
offline before deterministic deduplication and native observed turn aggregation.
There were zero duplicate exclusions in either sample:

| Year | Regional source rows | Quality-passing selected rows |
| --- | --- | --- |
| 2019 | 5,647 | 5,227 |
| 2020 | 33,413 | 30,132 |

Observed FRP and detection-count pairs now have explicit region, date, D/N,
metric, common derived dataset and quality/dedup rule versions. They are actual
observed positive cohorts, not calibrated predictions or complete AOI coverage.

2019 dry training support is Terra D=14/N=12 and Aqua D=15/N=10 paired dates, all
from one year. Every stratum fails the 30-date/three-year training floor. In 2020,
Terra D/N and Aqua D have 15 test dates; Aqua N has 13 and also fails its test
sample floor. Passing a sample floor alone would not constitute model approval.

The scientific decision registry, frozen application datasets and harmonization
gates are unchanged. The updated protocol/readiness report no longer marks the
resolved methods as unanswered. Missing data and delivery-4 thresholds remain
explicit. No new NASA request or credential was needed.
