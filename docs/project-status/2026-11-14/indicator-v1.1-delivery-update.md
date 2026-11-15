# ChronoFlare — deterministic indicator v1.1 preparation

Historical delivery-3 snapshot. Delivery 4 supersedes the primary weekly scoring
scale and test-year floor; see `docs/scientific-thresholds.md`.

Reviewed November 14, 2026 (São Paulo). The primary versioned document resolves
the four delivery-3 implementation questions; no additional clarification request
is introduced. Approval thresholds still belong to delivery 4.

## What was implemented

The observed-data pipeline revalidates the original CSVs, repeats the official
region cut, computes quality first, and then selects technical-key winners.
Priority is SP, largest unrounded Float64 FRP, highest confidence, smallest
detection ID and stable source provenance. All failed/duplicate raw rows retain
an audit disposition. Same-minute adjacent pixels are summed; spatial connected
components and NRT ingestion remain disabled.

The coordinate engine is explicitly CPython Float64 round(value, 5), as named in
the primary document. Native rounding is pinned by tests and is not assumed
identical to Decimal, NumPy or SQL rounding at representation boundaries. This
choice does not alter the existing real samples, which have no key collisions.

Observed native-scale FRP sums and counts are now produced by platform, solar
day and day/night turn. They retain unknown cloud/AOI coverage and null missing
observations, fractions and overpass counts. No calibration is implied.

Separate mathematical primitives implement complete D+N daily-estimate gating,
convex platform combination, regularized inverse-OOF-MAE weights, ISO weekly
support and the supplied empirical-quantile interval recipe. They accept explicit
parameters, never learn them from the current samples or grant approval.

## Canonical weekly and uncertainty decisions

The primary v1.1 governs where its companion presents alternatives: ISO weeks
start Monday, require five matched days and use seven-day-equivalent paired
values. Daily means remain a separate diagnostic. Period ends use the next
Monday, exclusive. Delivery-4 MAE thresholds must use the same weekly scale.
Paired-day fractions describe temporal support, not measured cloud coverage.

Nominal 80% bands apply supplied OOF residual-ratio q10/q90 values, with 1.25
pre-2012 inflation. The helper rejects invalid bounds. Quantiles are not fitted
in this change; empirical coverage and model approval remain untested. A nominal
level is not a guaranteed finite-sample coverage claim.

## Verified real-data results

Both frozen years were reconstructed offline from their source hashes:

| Year | Regional source rows | Quality-passing selected rows | Duplicate exclusions |
| --- | --- | --- | --- |
| 2019 | 5,647 | 5,227 | 0 |
| 2020 | 33,413 | 30,132 | 0 |

The output contains 90 platform/day/turn cells per year and actual observed
same-turn cohorts for both FRP and detection counts. Pairing does not turn native
MODIS observations into calibrated estimates. All missing-partner/outside/null
exclusions remain explicit.

Training sample support is still insufficient:

| Stratum | Positive paired train dates | Training years | Paired test dates |
| --- | --- | --- | --- |
| Terra D | 14 | 1 | 15 |
| Terra N | 12 | 1 | 15 |
| Aqua D | 15 | 1 | 15 |
| Aqua N | 10 | 1 | 13 |

Every training stratum fails the registered 30-date/three-year floor. Aqua N
also fails the 15-date test floor. Collapsing seasons cannot manufacture years
or fill missing observations. The final holdout is not used to expand training.

## Reproducibility and remaining stages

Source reconstruction passed without a FIRMS key or new NASA requests:
https://github.com/j-c-fstk-dev/chronoflare/actions/runs/43665888922

Sanitized observations and the protocol-bound summary are committed under
docs/indicator-observations. Full raw dispositions are retained for thirty days
in the observed-indicator-evidence artifact. A separate job publishes only to a
review branch, never main or production. Original CSVs remain in the source
training-period artifact and are bound by their hashes.

| Stage | Completed | Remaining |
| --- | --- | --- |
| Quality/deduplication | Deterministic implementation and per-source audit | Broader input collection |
| Observed aggregates | Native platform/day/turn sums, counts and pairing | Intentional future application dataset version |
| Daily/weekly math | Strict turns, convex weights, ISO/support and interval recipe | Real fitted parameters and calibrated daily predictions |
| Samples | Distinct date/year gate applied to both years | At least three training years and enough paired dates, wet-season support |
| Validation/approval | No fit or approval invented; holdout kept separate | Delivery 4, training-only model selection and independent validation |

All 148 Python tests passed locally. They cover winner precedence, invalid-row
exclusion before deduplication, shuffle-stable ties, pinned coordinate rounding,
missing turns, convex/zero-error behavior, ISO year and train/test edges,
five/six/seven-day support, supplied interval arithmetic and complete real-output
reconciliation. Language and whitespace checks passed. No frontend code changed.

The scientific decision registry, frozen calendar and exact source inspector
remain unchanged. The previous method questions are marked resolved in the review
and handoff documentation. No new key or manual download is needed from André.
