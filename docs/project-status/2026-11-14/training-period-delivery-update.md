# ChronoFlare — bounded 2019 training-period acquisition

> **Historical/stage-specific record.** This page preserves the facts, test counts and remaining work of its original delivery. It is not the current project approval or feature checklist. See [current validation and scope](../../validation-report.md) and the [documentation index](../../README.md). Any associated dated PDF/Word remains that historical snapshot.

Prepared November 14, 2026 (São Paulo). This update follows validation preflight.
The public application and scientific decision registry remain unchanged.

## Delivered acquisition and rationale

The pilot acquired MODIS SP and VIIRS S-NPP SP data for August 1–15, 2019, with
August 16 UTC padding to complete the last solar day. Eight bounded requests
passed provider-response validation. The request rectangle contains the same
pinned official IBGE 2025 Pantanal polygon used by the existing dataset.

The eight original 2020 API files were reprocessed offline using the same new
SP quality classifier, region and solar convention. This avoids comparing 2019
under delivery-3 rules with 2020 under the earlier preview's candidate filter.
Both years remain separate inputs; no model fitting or tuning consumed them.

## Observed audit results

| Year / platform | Regional solar records | Quality pass before dedup |
| --- | --- | --- |
| 2019 Terra | 485 | 461 |
| 2019 Aqua | 753 | 713 |
| 2019 S-NPP | 4,409 | 4,053 |
| 2020 Terra | 2,655 | 2,481 |
| 2020 Aqua | 4,210 | 3,950 |
| 2020 S-NPP | 26,548 | 23,701 |

2019 contains 5,647 regional solar observations, with 5,227 passing the new SP
quality rule before final deduplication. Counts are audit diagnostics, not
individual fires, an approved indicator or a calibrated trend between years.
Coverage fractions and overpass counts remain null; absent positives stay null.

The 2020 replay has three non-positive-FRP S-NPP rejection occurrences. One had
passed the old preview filter, so the new quality selection has one fewer S-NPP
record: 23,701 instead of 23,702. The frozen UI still correctly describes its
older candidate snapshot; it is not silently rewritten or relabeled.

Each year has a 90-cell platform/day/night inventory. Potential positive same-turn
co-occurrence with S-NPP is 26 Terra and 25 Aqua groups in 2019, versus 30 and 28
in 2020. These are not final validation pairs and missing partners are not zeros.

The five-decimal duplicate key was audited under both half-even and half-up
rounding. No collision was found in either sample. No policy was silently chosen,
no winner selected and no original source row removed. The scientific policy
still needs resolution for future conflicting inputs.

## Evidence and reproducibility

Sixteen original CSVs, safe provenance, regional lineage and audit outputs are
retained in the training-period-evidence Actions artifact for 30 days. Source
hashes, retrieval metadata, request dates, normalization summaries, quality
rejections and turn inventories are committed as sanitized reports.

Fresh acquisition uses the existing FIRMS_MAP_KEY for exactly eight 2019 calls.
2020 replay is bound to the frozen calendar CSV hashes and checked before new
requests are spent. A two-year replay mode verifies 2019 against the committed
acquisition hashes and 2020 against the calendar, requiring no FIRMS key or NASA
request. It skips report publication so the original acquisition report remains
clearly identifiable.

The publisher is a separate job without the FIRMS key. Its repository-write
permission saves only sanitized reports on a dedicated review branch, not main
or deployment. Raw data is not placed in frontend assets.

Acquisition run:
https://github.com/j-c-fstk-dev/chronoflare/actions/runs/43663652155

A first successful replay of the two-year bundle also completed with zero new
NASA calls:
https://github.com/j-c-fstk-dev/chronoflare/actions/runs/43663940772

## Decisions and remaining stages

| Stage | Completed | Remaining |
| --- | --- | --- |
| Acquisition | Bounded 2019 pilot plus frozen 2020 replay | More years and wet-season support, explicitly budgeted |
| Quality | Same strict SP classifier applied to both years | New versioned final indicator output after policy resolution |
| Duplicates | Two rounding scenarios audited, no current collisions | Register conflict/tie and quality-order policy |
| Turn support | Separate per-platform D/N inventory and unmatched support counts | Final same-turn aggregate/pairing approval and missing-turn semantics |
| Training/test separation | 2019 labeled forward-training candidate; 2020 held-out candidate | Sufficient multi-year inputs and preregistered validation |
| Calibration/approval | No fit, coefficient, uncertainty or approval generated | Delivery 4 and the previous scientific clarifications |
| Frontend | Existing 2020 calendar/map/inspector preserved | Intentional future dataset-selector/generalization work |

The pilot reads pinned geometry without loading 2020 detection shards to build
2019 inputs. It evaluates an input-quality sample, not a full 2012–2019 training
corpus. Both fifteen-day windows are in the dry season; no seasonal or annual
performance claim is supported.

All 132 Python tests passed locally. Checks cover request partitioning and
padding, rounding sensitivity without data removal, null missing turns,
source-hash failures before requests, offline replay without a key, and
reconciliation of both real reports with source metadata and frozen 2020 counts.
Language and whitespace checks passed. No frontend code changed.

The operational guide is docs/training-period-pilot.md. No additional credential
or new scientific question was introduced by this acquisition.

The current two-year replay also passed without supplying FIRMS_MAP_KEY:
https://github.com/j-c-fstk-dev/chronoflare/actions/runs/43664381035
It reported zero NASA requests and sixteen source-file replays.
