# ChronoFlare — experimental real calendar and coverage v1.2

> **Historical/stage-specific record.** This page preserves the facts, test counts and remaining work of its original delivery. It is not the current project approval or feature checklist. See [current validation and scope](../../validation-report.md) and the [documentation index](../../README.md). Any associated dated PDF/Word remains that historical snapshot.

Delivered November 14, 2026. This update follows the historical ingestion pilot.
Scientific approval remains pending; no harmonization was enabled.

## Delivered behavior

Calendar now offers a **Calendar dataset** selector. The default remains the
synthetic demonstration and its existing comparison chart. Selecting **Real
detections · experimental · August 2020** opens a separate solar-day preview for
August 1–15, with Terra, Aqua and S-NPP kept separate.

The fifteen-day heatmap displays recorded detection counts. Users can inspect a
day, change platform, or test the proposed vegetation selection. The selection is
explicitly unapproved; all-detection counts remain the default. Raw FRP sums are
confined to an audit detail with their limitations. No fire-event counts, energy,
area burned, baseline or anomaly results are inferred.

## Processing and evidence

The six previously downloaded API files are revalidated and reused. Only two new
requests were needed, one per source for August 16 UTC, to complete the final
solar day. The preview contains 45 unique day/platform entries. Each interval is
half-open from 03:46:36 UTC to the same time the next day.

| Platform | Recorded detections | Proposed filter, unapproved |
| --- | --- | --- |
| Terra | 2,655 | 2,481 |
| Aqua | 4,210 | 3,950 |
| S-NPP | 26,548 | 23,702 |

These are solar-date totals from the independent API input. They are not expected
to equal the map's original UTC delivery totals. All original reference records
matched during reconciliation, while 96 additional API records remain documented
without claiming their cause has been established.

The proposed filter selects source type 0 with MODIS confidence at least 30 or
VIIRS nominal/high. Missing classifications are not selected; repeated records
remain. Per-day rejection counts and reasons are retained alongside raw-row
lineage. Eight source CSV hashes and safe request/retrieval metadata accompany
the projected frontend asset.

## Coverage v1.2 review

The supplier's new official URLs were fetched and their content checked. Five
selected MODAPS outage intervals were verified, including the combined S-NPP
2022 lock-up entries. NOAA Update #4 and NASA Earthdata confirm cessation of new
S-NPP data delivery on November 2, 2026 at 15:40 UTC.

A separate negative-evidence module now converts closed UTC intervals to the
fixed-reference solar days. It identifies outage days, a partial cessation day,
and subsequent days after data delivery ended. Closed endpoints and midnight
boundaries are tested. The old unverified proposal remains historical and disabled.

Operational availability is not treated as measured AOI coverage. Every preview
row retains unknown coverage, null coverage fraction and null overpass count.
No zero is inferred for a day without positive records. The cutoff day is not
assigned a fabricated fraction of 0.50. Dates at the start of an archive are not
used as spacecraft launch dates. The new selected catalogue is not exhaustive.

## Decisions and changes from the initial plan

- Use an independent experimental schema instead of weakening the scientific
  aggregate contract or marking demonstration data as real.
- Display detection counts first; expose raw FRP only as an audit statistic until
  the indicator definition is approved.
- Make proposed quality selection explicit rather than silently applying it.
- Reuse historical evidence and fetch only missing UTC padding.
- Accept the verified v1.2 negative facts while retaining strict missing-background
  handling. Nominal turn counts do not become measured observation coverage.
- Preserve existing demo, comparison and raw-map URL parameters. The experimental
  namespace supports Back/Forward without changing the other datasets' choices.

## Verification and remaining stages

| Stage | Completed | Remaining |
| --- | --- | --- |
| Acquisition | Two real padding requests passed; six base files reused | Larger periods and equivalent second year when selected |
| Regional/solar processing | Pinned polygon, original-row lineage, complete input windows | Scientific approval of interpretation |
| Quality | Raw and proposed-filter counts plus rejection reasons | Final indicator/filter and duplicate policy in indicator.md |
| Coverage | Verified selected outages and data cessation | Measured background/cloud/overpass evidence before full coverage claims |
| Frontend | Experimental counts calendar, details, independent errors and history | Approved metric and eventual real year-to-year comparison |
| Documentation | Operational guide, source review and Portuguese feedback | Update decisions only when scientific approval is supplied |

Verification passed: 96 Python tests, 95 TypeScript tests, production build,
English language check and whitespace checks. Browser checks covered desktop and
390px mobile layout, keyboard day selection, Back/Forward, platform/filter
restoration, map/demo switching and an injected HTTP 503. No JavaScript page errors
or horizontal mobile overflow were observed. This is Chromium mobile emulation;
a physical iPhone/Safari pass remains useful after deployment.

Live padding/export run:
https://github.com/j-c-fstk-dev/chronoflare/actions/runs/43653047029

The seven-day Actions artifact retains all eight original CSVs, safe provenance,
regional lineage, base reconciliation and the projected preview asset. The
frontend summary and source metadata are committed. No extra key was needed.

Next scientific input: indicator.md confirming quality selection, metric and units
per platform, duplicate treatment, any combination rule, and comparison/validation
periods. The engineering preview can be reviewed while those decisions are made.
