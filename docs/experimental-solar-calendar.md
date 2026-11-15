# Experimental real-detection solar calendar

Scope: a retained, unreviewed August 2020 preview, separate from the default
[approved real-data calendar](real-observation-experience.md). Its optional filter,
raw counts and no-dedup rules are not promoted by the later v2 approval.

## Open the preview

Open **Calendar → Calendar dataset → Real detections · experimental · August
2020**, or use `?view=calendar&calendar_data=experimental` on the deployed site.
The original demonstration is still selectable. The experimental preview is
independent of the demonstration loader and its year-to-year chart.

Choose Terra, Aqua or S-NPP, then a solar day. The default shows all recorded
detections. The optional proposed vegetation filter is explicitly unapproved:
source type 0, MODIS confidence at least 30, or VIIRS nominal/high confidence.
Missing required classification is not selected. Records are not deduplicated.

Color encodes **recorded detection counts**, using a separate relative scale per
platform and selection. Counts are not individual fire events and must not be
compared across platforms as equivalent sensitivity. There is no historical
baseline, anomaly score or real year-to-year chart in this fifteen-day dataset.

## Acquisition and traceability

The six original pilot CSVs are revalidated from their retained Actions artifact.
Two additional authenticated requests fetch August 16 UTC, one per source. This
supplies the beginning of August 16 needed to finish August 15's solar window.
No extra July 31 request is necessary for a preview starting at August 1 solar.

The pinned IBGE 2025 polygon, point-centre membership and source normalization
are unchanged. Each solar day uses `[03:46:36Z, next-day 03:46:36Z)`. The preview
contains exactly fifteen days and three separate platforms. Extra downloaded
rows outside these solar dates are excluded from the preview but remain in the
original CSVs.

Every regional intermediate record retains source CSV hash, row number, raw row,
request identifier, derived solar date and proposed-filter result/reasons. Eight
CSV hashes and safe retrieval provenance are published with the summary.

The committed asset is `app/public/data/experimental/v1/pantanal-solar.json`.
Its schema is separate from the approved scientific aggregate contract. It has
`scientific_approval=false`, `approved_metric=false` and `coverage_status=unknown`.
The frontend rejects duplicate days, incorrect solar windows, mismatched quality
counts, missing padding provenance, zeros in positive counts and approval claims.

## Scientific interpretation

A complete requested input window is not complete observed/clear-sky coverage.
Days with no positive records in a selection show a dash, not observed zero.
Coverage fractions and overpass counts remain null. A raw FRP sum of zero is
not promoted to an activity metric. Raw FRP sums are available only in an audit
detail: they combine observations across passes and are not energy or burned area.

The [v1.2 coverage review](coverage-v1.2-review.md) verifies five selected outage
intervals and S-NPP data cessation. These provide negative evidence only; they do
not turn nominal operation into full AOI coverage. This frozen preview has no
harmonized series. The separate [current v2 approval](validation-report.md) applies
to the reviewed export, not to this preview or its proposed filter.

The source reconciliation reproduced all 33,243 original observations on the
compared fields including type, with 96 additional API observations. Their cause
remains under review. The map continues to use its original delivery; the new
calendar explicitly uses the independent API input. Its totals also differ from
UTC map totals because it uses solar-day boundaries and padding.

## Verified result

| Platform | Recorded detections, solar August 1–15 | Proposed filter, unapproved |
| --- | --- | --- |
| Terra | 2,655 | 2,481 |
| Aqua | 4,210 | 3,950 |
| S-NPP | 26,548 | 23,702 |

Acquisition and export passed in:
https://github.com/j-c-fstk-dev/chronoflare/actions/runs/43653047029

The retained `firms-solar-preview-evidence` artifact includes all eight raw CSVs,
provenance, base audit, regional lineage and the exact projected frontend asset.
Artifacts expire after seven days; the frontend summary and source catalogue are
committed. No credentials or credential-bearing URLs are included.

To reproduce, run the existing Actions workflow with `mode=preview` and
`replay_run_id` pointing to a retained successful pilot artifact. This issues two
padding requests and reuses the previous six; no additional key is needed.
Export is offline. Promotion into application assets is an explicit reviewed
commit, not an automatic workflow deployment.

## Navigation, failure and remaining work

The URL namespace is `calendar_data`, `solar_platform`, `solar_day`, `solar_filter`.
It preserves the original calendar, comparison and raw-map parameters. Back and
Forward restore the preview choices. Loading or schema failure leaves the demo
and map available, with a retry action for experimental data.

The later indicator rules, independent v2 validation and primary real-calendar
integration are complete under a separate contract. This preview remains frozen
and unreviewed rather than inheriting their approval. Its own fifteen-day input
still does not support annual comparison, baseline or anomaly claims. No extra
credentials are required to view its committed assets.

Browser review screenshots: [desktop](experimental-solar-calendar/desktop.png)
and [mobile](experimental-solar-calendar/mobile.png). The mobile image is
Chromium viewport emulation; physical iPhone/Safari review remains a deployment
follow-up.

The selected cell now offers [exact source inspection](solar-detection-inspector.md):
a map, accessible table and source-row links bound to the same API/solar snapshot.
It is distinct from the earlier delivery in the main Map view.
