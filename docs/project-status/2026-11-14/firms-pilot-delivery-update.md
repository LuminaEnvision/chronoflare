# ChronoFlare — historical API ingestion and reconciliation

> **Historical/stage-specific record.** This page preserves the facts, test counts and remaining work of its original delivery. It is not the current project approval or feature checklist. See [current validation and scope](../../validation-report.md) and the [documentation index](../../README.md). Any associated dated PDF/Word remains that historical snapshot.

Delivered November 14, 2026. This update follows the MapBiomas delivery and the
coverage v1.1 solar-time helper. All results remain scientifically unreviewed.

## What was delivered and why

A bounded six-request pipeline obtains MODIS SP and VIIRS S-NPP SP observations
for August 1–15, 2020. Reusing the existing downloader and normalizer preserves
original CSV bytes, hashes and raw-row lineage while validating API responses.
The repository Actions secret supplies authentication; no additional key is needed.

The pinned official IBGE 2025 polygon is applied after the API bounding-box
selection. The same polygon and original review shards define the comparison
reference. All pinned asset hashes and counts are checked before downloading.

Regional detections receive the explicit fixed-reference solar dates from v1.1.
Daily audit outputs retain Terra, Aqua and S-NPP separately. Days without
positives produce null audit totals; every row retains unknown coverage and a
null overpass count. July 31 and August 15 are flagged as only partly included in
the requested UTC window. A complete input window is not evidence of clear-sky
observation coverage.

## Observed results

| Source | Existing regional reference | API regional records | Matched including source type | API-only occurrences |
| --- | --- | --- | --- | --- |
| MODIS | 6,779 | 6,791 | 6,779 | 12 |
| VIIRS S-NPP | 26,464 | 26,548 | 26,464 | 84 |
| Total | 33,243 | 33,339 | 33,243 | 96 |

There were no reference-only occurrences and no repeated shared-field signatures
in either regional input. Matches include UTC time, platform, longitude, latitude,
FRP, confidence and source type. They do not assert equality of every original
CSV column, such as brightness or pixel dimensions.

The MODIS API additions are all source type 0. VIIRS additions contain 77 type 0
and seven type 3 records. All existing matched records retain their source type;
there is no evidence here of a type change among the matched observations.
Recorded API version tokens are 6.03 for MODIS and 2 for VIIRS, matching the
reference metadata. Those tokens are reported as supplied, not independently
reinterpreted as a full product catalogue version.

API platform counts are Terra 2,581, Aqua 4,210 and S-NPP 26,548. Low confidence
and nonzero source types are retained for audit. No filtering decision is hidden
in these totals.

The initial API request covers a rectangle; the supplier's original request was
for Brazil. Their spatial selections differ before the common polygon cut.
This is a reason to investigate the additions, not proof of their cause. The
pipeline records the difference without silently substituting one input for the
other or declaring either scientifically approved.

## Decisions and differences from the initial plan

- Historical API access was directly verified. The earlier assumption that 2020
  data necessarily required manual archive downloads was too restrictive.
- Instead of immediately replacing data after equal-count checks, reconciliation
  compares multisets and preserves duplicate multiplicity and field differences.
- Raw daily FRP sums are offline audit statistics only. They combine detections
  across passes and are not energy, burned area or an approved activity metric.
- Experimental calendar integration is deferred until the quality/metric policy
  and input-edge handling are explicit. The existing map and synthetic calendar
  keep their current sources and labels.
- An offline replay mode rechecks retained CSVs without spending API requests.
  It verifies hashes, request dates/bounds and normalization again.
- The unverified outage catalogue remains disabled. API success or absent
  detections never establishes complete observation coverage.

## Validation and remaining stages

| Stage | Completed | Remaining |
| --- | --- | --- |
| Acquisition | Live authenticated requests for both historical sources passed | Explicit scheduling and larger periods only when needed |
| Reconciliation | All 33,243 reference observations reproduced; 96 additions recorded | Establish the cause of additions before treating the inputs as interchangeable |
| Regional processing | Pinned IBGE geometry, source-row lineage and solar dates | Scientific approval of quality selection and interpretation |
| Daily processing | Separate platform audits, null background and boundary flags | Fetch UTC padding for full solar-day input windows; define approved metric |
| Frontend | Existing raw map remains available | Experimental real calendar dataset and later equivalent second year |
| Coverage | Strict null handling and outage isolation | Reconcile official outage sources with André |

The local Python suite passed 86 tests, including request partitioning, reference
integrity, duplicate-aware comparisons, source-type differences, missing-background
handling, solar edges, regional filtering, lineage, atomic failure and cached
response tampering. The English language and whitespace checks passed.
Live acquisition and offline replay also passed in GitHub Actions.

## Evidence and reproduction

- Live run: https://github.com/j-c-fstk-dev/chronoflare/actions/runs/43651494471
- Offline replay: https://github.com/j-c-fstk-dev/chronoflare/actions/runs/43651683222
- Persistent sanitized summary: docs/firms-pilot-evidence/2020-08-01_15-summary.json
- Operational guide: docs/firms-pilot-ingestion.md

Each successful run retains a seven-day Actions artifact containing raw CSVs,
provenance, regional records and the daily audit. The summary is committed for
longer-lived review. Credentials and credential-bearing request URLs are excluded.
