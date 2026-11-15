# Scientific validation and current approval

Current decision: **Plan A approved for the frozen v2 forward model in the Pantanal**.
Publication is restricted to dates with **both complete aligned Terra and Aqua inputs**.
The [owner decision](../science/configs/harmonization_decision.json), registered on
2026-11-15 at 17:11:26 UTC, and [written reply](handoff/andre-plan-a-decision.md) are
the approval authority. Automated scores do not sign off science on the owner's behalf.

## Registered independent forward evaluation

The v2 was frozen before its independent score. The owner registered the test before
acquisition of 1,868 previously unexamined target dates. All 28 blocks completed;
the frozen candidate was scored once. “Independent” refers to that registered
complement, not to every date in 2020–2026 or an independently tested new biome.

| Combined-view metric | Frozen v2 | Matched native benchmark | Registered criterion |
| --- | --- | --- | --- |
| Paired days / eligible ISO weeks | 506 / 40 | Same cohort | At least 120 / 25 |
| Weekly PBias | −1.0% | −29.4% | Within ±25% |
| Weekly Spearman | 0.965 | 0.971 | At least 0.75 |
| Weekly MAE | 1,675.5 MW | 2,589.0 MW | Strictly below matched benchmark |
| Relative MAE | 0.200 | 0.308 | At most 0.45 |
| Daily empirical 80% interval coverage | 72.7% | Not applicable | 70%–92% |
| Median relative interval width | 1.74 | Not applicable | At most 2.0 |

All registered combined forward checks passed. MAE is about 35.3% below the matched
benchmark; this is not an accuracy percentage or improvement on every metric.
Weekly errors use means over the same valid paired days, with at least five per
eligible ISO week. Interval coverage is daily, near the registered lower limit,
and does not guarantee an 80% hit rate. Weekly interval coverage is not defined
by this daily interval recipe.

## Publication and limits

The app contains 4,318 acquired solar dates in 2012–2015 and 2017–2026; 2016 was
not acquired. Only 635 dates have an approved published estimate:

- 232 dates are in the training period; agreement there is not validation evidence.
- 161 are previously examined dates; 242 belong to the independent holdout.
- Only six estimates are published in 2025 and five in 2026.
- 55 published estimates are flagged beyond the training range.

Publication requires both complete MODIS platforms, stricter availability than the
registered evaluation's mixed regimes. There are 620 published dates with complete
S-NPP references for the chart, including 229 independent pairs; those are not the
full 506-day evaluation. Missing dates and incomplete observations remain gaps,
not inferred zeros or evidence of no fire. Observation coverage remains unknown.

There is **no independent backward test**. The owner accepted the already examined
v2 backward result as descriptive evidence under the registered rule. No pre-2012
series, additional biome, anomaly classification, seasonal alert or forecast is
approved by this decision.

## Preserved experiment history

The original v1 combined forward candidate failed bias and matched-benchmark MAE
checks and selected Plan B. Its report, fitted models and receipts remain unchanged.
The initial v2 rerun on examined dates is post-hoc; it is not relabeled independent.
The later registered test and separate owner approval establish the current scoped
Plan A status. Generic fixture manifests still report their own synthetic/pending
state and are not the status of the primary real-data calendar.

## Evidence and implementation

- [Approved v2 method, chronology and limits](harmonization-v2-candidate.md).
- [Registered test](../science/configs/independent_holdout.registration.json).
- [Independent full-precision metrics](multiyear-evidence/v2-candidate/independent-summary-v2.json).
- [Frozen model](multiyear-evidence/v2-candidate/frozen-models-v2.json) and [freeze receipt](multiyear-evidence/v2-candidate/freeze-receipt-v2.json).
- [Historical rejected v1 report](multiyear-evidence/experiment-summary.json).
- [Published estimates and sample roles](multiyear-evidence/harmonized-series/pantanal-harmonized-daily-v2.json).
- [Browser manifest](../app/public/data/observations/v1/manifest.json) and [active export contract](observation-app-export-contract.md).

The approved model SHA-256 is
`3c39071a245d071c60e0838d6092a793190f98e2416e2074bbf75911e00aa3ba`.
Runtime schema/hash checks and automated tests verify interpretation and integrity;
they do not create scientific approval or replace device/user review.
